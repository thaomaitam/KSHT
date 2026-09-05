import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { dispatchBrowserApi } from "../../server/http/browserApi.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const envFor = (app: GiabanApplication, extra: Record<string, unknown> = {}) => ({
  ADMIN_SECRET: "root",
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "https://giaban.khosihuythao.com",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { return undefined; } },
  GIABAN: { handleBrowserApi: (envelope: Parameters<typeof dispatchBrowserApi>[1]) => dispatchBrowserApi(app, envelope) },
  ...extra,
});

const login = async (env: ReturnType<typeof envFor>) => {
  const response = await handleKshtApi(new Request("https://worker.example/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "pw" }),
  }), env);
  return (await response.json() as { token: string }).token;
};

test("authoritative domain rejects whole-key writes and serves public products without cost", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const context = ownerContext();
  const category = await app.execute({
    operationId: "createCategory",
    input: { label: "Cọ", value: "PAINT" },
  }, { ...context, idempotencyKey: "leg-cat" }) as { id: string };
  await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, { ...context, idempotencyKey: "leg-prd" });

  const env = envFor(app);
  const listed = await handleKshtApi(new Request("https://worker.example/api/v1/public/products"), env);
  assert.equal(listed.status, 200);
  const products = await listed.json() as { items: Array<{ variants: object[] }> };
  assert.equal("costPrice" in products.items[0].variants[0], false);

  const token = await login(env);
  const written = await handleKshtApi(
    new Request("https://worker.example/api/data/products", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "[]",
    }),
    env,
  );
  assert.equal(written.status, 423);
});

test("legacy sessions cannot merge customers", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const env = envFor(app);
  const token = await login(env);
  const response = await handleKshtApi(
    new Request("https://worker.example/api/v1/customers/merge/preview", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ canonicalCustomerId: "a", sourceCustomerId: "b" }),
    }),
    env,
  );
  assert.equal(response.status, 403);
});
