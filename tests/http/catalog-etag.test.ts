import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { dispatchBrowserApi } from "../../server/http/browserApi.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { createPublicCatalogStore } from "../../server/http/publicCatalogCache.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const ORIGIN = "https://giaban.example";

const seed = async (app: GiabanApplication) => {
  await app.execute({ operationId: "createCategory", input: { label: "Cọ", value: "PAINT" } }, ownerContext({ idempotencyKey: "c" }));
  const category = (await app.query({ operationId: "listCategories", input: {} }, ownerContext())).items[0];
  const product = await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, ownerContext({ idempotencyKey: "p" })) as { id: string; revision: number };
  return { category, product };
};

const updatePrice = async (app: GiabanApplication, product: any, price: number, key: string) => {
  const current = await app.query({ operationId: "getProduct", input: { id: product.id } }, ownerContext()) as any;
  await app.execute({
    operationId: "updateProduct",
    input: {
      id: current.id, name: current.name, categoryId: current.categoryId, description: current.description, image: current.image,
      variants: [{ size: "1", unit: "Cây", price, costPrice: 400 }],
    },
  }, { ...ownerContext({ idempotencyKey: key }), expectedRevision: current.revision });
};

const envFor = (app: GiabanApplication, counter = { origin: 0 }) => ({
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: ORIGIN,
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { return undefined; } },
  GIABAN: {
    handleBrowserApi: (envelope: Parameters<typeof dispatchBrowserApi>[1]) => {
      counter.origin += 1;
      return dispatchBrowserApi(app, envelope);
    },
    catalogVersion: () => app.catalogVersion(),
  },
  PUBLIC_CATALOG_CACHE: createPublicCatalogStore(),
});

const get = (env: ReturnType<typeof envFor>, path: string, headers: Record<string, string> = {}) =>
  handleKshtApi(new Request(`https://worker.example${path}`, { headers: { Origin: ORIGIN, ...headers } }), env);

test("catalogVersion changes on every product/category mutation and not on reads", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const { product } = await seed(app);
  const v1 = await app.catalogVersion();
  assert.equal(await app.catalogVersion(), v1);
  await app.query({ operationId: "listPublicProducts", input: {} }, ownerContext());
  assert.equal(await app.catalogVersion(), v1);
  await updatePrice(app, product, 1500, "u");
  const v2 = await app.catalogVersion();
  assert.notEqual(v2, v1);
  await app.execute({ operationId: "createCategory", input: { label: "Rulo", value: "ROLLER" } }, ownerContext({ idempotencyKey: "c2" }));
  assert.notEqual(await app.catalogVersion(), v2);
});

test("public catalog returns ETag + no-cache and 304 on matching If-None-Match", async () => {
  const app = new GiabanApplication(new MemoryStore());
  await seed(app);
  const env = envFor(app);
  for (const path of ["/api/v1/public/products", "/api/v1/public/categories"]) {
    const first = await get(env, path);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "public, no-cache");
    const etag = first.headers.get("etag");
    assert.match(etag || "", /^"cv-[0-9a-f]{16,}"$/);
    assert.equal(first.headers.get("x-catalog-version"), etag?.slice(4, -1));
    assert.match(first.headers.get("access-control-expose-headers") || "", /ETag/i);
    assert.match(first.headers.get("access-control-expose-headers") || "", /X-Catalog-Version/i);
    const second = await get(env, path, { "If-None-Match": etag! });
    assert.equal(second.status, 304);
    assert.equal(second.headers.get("etag"), etag);
    assert.equal(await second.text(), "");
    assert.equal(second.headers.get("access-control-allow-origin"), ORIGIN);
  }
});

test("memory hit keeps no-cache and ETag; a price change in another isolate is visible immediately", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const { product } = await seed(app);
  const counter = { origin: 0 };
  const isolateA = envFor(app, counter);
  const first = await get(isolateA, "/api/v1/public/products");
  const etag = first.headers.get("etag");
  const hit = await get(isolateA, "/api/v1/public/products");
  assert.equal(counter.origin, 1, "second read is a memory hit");
  assert.equal(hit.headers.get("cache-control"), "public, no-cache");
  assert.equal(hit.headers.get("etag"), etag);

  // Mutation handled elsewhere (no purge in isolate A).
  await updatePrice(app, product, 2500, "u");

  const stale = await get(isolateA, "/api/v1/public/products", { "If-None-Match": etag! });
  assert.equal(stale.status, 200);
  assert.notEqual(stale.headers.get("etag"), etag);
  const body = await stale.json() as { items: Array<{ variants: Array<{ price: number }> }> };
  assert.equal(body.items[0].variants[0].price, 2500);
});
