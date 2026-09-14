import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { createPublicCatalogStore } from "../../server/http/publicCatalogCache.ts";
import { dispatchBrowserApi } from "../../server/http/browserApi.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";


const envFor = (app: GiabanApplication) => ({
  ADMIN_SECRET: "root",
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { return undefined; } },
  GIABAN: { handleBrowserApi: (envelope: Parameters<typeof dispatchBrowserApi>[1]) => dispatchBrowserApi(app, envelope) },
  PUBLIC_CATALOG_CACHE: createPublicCatalogStore(),
});

test("composed worker serves /api/v1 and leaves legacy /api/status intact", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const env = envFor(app);
  const login = await handleKshtApi(new Request("https://worker.example/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "pw" }),
  }), env);
  const session = await login.json() as { token: string };
  const v1 = await handleKshtApi(new Request("https://worker.example/api/v1/status", {
    headers: { authorization: `Bearer ${session.token}` },
  }), env);
  assert.equal(v1.status, 200);
  const legacy = await handleKshtApi(new Request("https://worker.example/api/status"), env);
  assert.equal(legacy.status, 200);
  assert.deepEqual(await legacy.json(), { ok: true });
});

test("ksht-api caches public catalog GET, bypasses no-cache, and purges after catalog write", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const env = envFor(app);
  let originCalls = 0;
  const inner = env.GIABAN.handleBrowserApi;
  env.GIABAN.handleBrowserApi = async (envelope) => {
    originCalls += 1;
    return inner(envelope);
  };
  await app.execute({
    operationId: "createCategory",
    input: { label: "Cọ", value: "PAINT" },
  }, ownerContext({ idempotencyKey: "c" }));
  const category = (await app.query({ operationId: "listCategories", input: {} }, ownerContext())).items[0];
  await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, ownerContext({ idempotencyKey: "p" }));

  const first = await handleKshtApi(new Request("https://worker.example/api/v1/public/products"), env);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "public, max-age=600");
  const firstBody = await first.json();
  assert.equal(firstBody.items.length, 1);
  const second = await handleKshtApi(new Request("https://worker.example/api/v1/public/products"), env);
  assert.equal(second.status, 200);
  assert.equal(originCalls, 1);

  const bypass = await handleKshtApi(new Request("https://worker.example/api/v1/public/products", {
    headers: { "Cache-Control": "no-cache" },
  }), env);
  assert.equal(bypass.status, 200);
  assert.equal(originCalls, 2);

  const login = await handleKshtApi(new Request("https://worker.example/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "pw" }),
  }), env);
  const session = await login.json() as { token: string };
  const created = await handleKshtApi(new Request("https://worker.example/api/v1/products", {
    method: "POST",
    headers: {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
      "Idempotency-Key": "p2",
    },
    body: JSON.stringify({
      name: "Cọ 2",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 2000, costPrice: 400 }],
    }),
  }), env);
  assert.equal(created.status < 400, true);
  const afterWrite = await handleKshtApi(new Request("https://worker.example/api/v1/public/products"), env);
  assert.equal(afterWrite.status, 200);
  const afterBody = await afterWrite.json();
  assert.equal(afterBody.items.length, 2);
  assert.equal(originCalls, 4);

  const status = await handleKshtApi(new Request("https://worker.example/api/v1/status", {
    headers: { authorization: `Bearer ${session.token}` },
  }), env);
  assert.equal(status.headers.get("cache-control"), "no-store");
});
