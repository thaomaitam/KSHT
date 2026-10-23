import assert from "node:assert/strict";
import test from "node:test";

import legacyWorker from "../../cloudflare_worker.js";
import { PRIVATE_DATA_KEYS, PUBLIC_READ_KEYS } from "../../workerContract.js";
import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { API_V1_ROUTES } from "../../server/http/adapter.ts";
import { dispatchBrowserApi } from "../../server/http/browserApi.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { createPublicCatalogStore } from "../../server/http/publicCatalogCache.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

// Any key that smells like admin-only data must never appear in an anonymous response.
const FORBIDDEN_KEY = /^(cost.*|costPrices?|cogs|margin|supplier.*|internal.*|adminSecret|password|secret|bankName|accountNumber|accountName|orders?|customers?|transactions?|payments?|audit.*|backups?|grants?|principals?|idempotency)$/i;

const leakedKeys = (value: unknown, path = "$", out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach((item, index) => leakedKeys(item, `${path}[${index}]`, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key)) out.push(`${path}.${key}`);
      leakedKeys(child, `${path}.${key}`, out);
    }
  }
  return out;
};

const seededApp = async () => {
  const app = new GiabanApplication(new MemoryStore());
  await app.execute({ operationId: "createCategory", input: { label: "Cọ", value: "PAINT" } }, ownerContext({ idempotencyKey: "c" }));
  const category = (await app.query({ operationId: "listCategories", input: {} }, ownerContext())).items[0];
  const live = await app.execute({
    operationId: "createProduct",
    input: { name: "Cọ", categoryId: category.id, description: "d", image: "", variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }] },
  }, ownerContext({ idempotencyKey: "p" })) as { id: string; revision: number };
  const archived = await app.execute({
    operationId: "createProduct",
    input: { name: "Ẩn", categoryId: category.id, description: "d", image: "", variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }] },
  }, ownerContext({ idempotencyKey: "p2" })) as { id: string; revision: number };
  await app.execute({ operationId: "archiveProduct", input: { id: archived.id } }, { ...ownerContext({ idempotencyKey: "a" }), expectedRevision: archived.revision });
  return { app, live, archived };
};

const envFor = (app: GiabanApplication) => ({
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { throw new Error("must not write"); } },
  GIABAN: {
    handleBrowserApi: (envelope: Parameters<typeof dispatchBrowserApi>[1]) => dispatchBrowserApi(app, envelope),
    catalogVersion: () => app.catalogVersion(),
  },
  PUBLIC_CATALOG_CACHE: createPublicCatalogStore(),
});

const concretePath = (pattern: string | RegExp, id: string): string =>
  typeof pattern === "string" ? pattern : pattern.source.replace(/^\^/, "").replace(/\$$/, "").replace(/\\\//g, "/").replace("([^/]+)", id);

test("every non-public /api/v1 route rejects anonymous and forged-token callers", async () => {
  const { app, live } = await seededApp();
  const env = envFor(app);
  assert.ok(API_V1_ROUTES.length >= 80, `route table looks incomplete (${API_V1_ROUTES.length})`);
  for (const route of API_V1_ROUTES) {
    const path = concretePath(route.path, live.id);
    const init = (headers: Record<string, string> = {}): RequestInit => ({
      method: route.method,
      headers: { "content-type": "application/json", "Idempotency-Key": "k", ...headers },
      body: route.method === "GET" ? undefined : "{}",
    });
    const anon = await handleKshtApi(new Request(`https://w.example${path}`, init()), env);
    const forged = await handleKshtApi(new Request(`https://w.example${path}`, init({ Authorization: "Bearer forged.token" })), env);
    assert.equal(forged.status, 401, `${route.method} ${path} with forged token`);
    if (route.public) {
      assert.equal(route.method, "GET", `public route must be read-only: ${route.method} ${path}`);
      assert.ok([200, 404].includes(anon.status), `${route.method} ${path} -> ${anon.status}`);
      const text = await anon.text();
      assert.deepEqual(text ? leakedKeys(JSON.parse(text)) : [], [], `${path} leaks admin fields`);
    } else {
      assert.equal(anon.status, 401, `${route.method} ${path} must require admin, got ${anon.status}`);
      assert.doesNotMatch(await anon.text(), /cost|order_|cus_|prd_/i);
    }
  }
});

test("public product endpoints never return archived products or cost fields", async () => {
  const { app, live, archived } = await seededApp();
  const env = envFor(app);
  const list = await (await handleKshtApi(new Request("https://w.example/api/v1/public/products"), env)).json() as { items: Array<{ id: string }> };
  assert.deepEqual(list.items.map((item) => item.id), [live.id]);
  const one = await handleKshtApi(new Request(`https://w.example/api/v1/public/products/${live.id}`), env);
  assert.equal(one.status, 200);
  assert.deepEqual(leakedKeys(await one.json()), []);
  const hidden = await handleKshtApi(new Request(`https://w.example/api/v1/public/products/${archived.id}`), env);
  assert.equal(hidden.status, 404);
  for (const path of ["/api/v1/public/settings", "/api/v1/public/categories", "/api/v1/status", "/api/v1/capabilities", "/api/v1/nope"]) {
    const response = await handleKshtApi(new Request(`https://w.example${path}`), env);
    const text = await response.text();
    if (text) assert.deepEqual(leakedKeys(JSON.parse(text)), [], path);
  }
});

const legacyEnv = () => {
  const values: Record<string, unknown> = {
    products: [
      { id: "p1", name: "A", category: "X", description: "", image: "", isHot: false, supplier: "s", internalNote: "n", costPrice: 1, variants: [{ size: "1", unit: "u", price: 9, costPrice: 3, cost: 3 }] },
      { id: "p2", name: "Hidden", category: "X", description: "", image: "", archived: true, variants: [] },
    ],
    categories: [{ id: "c", label: "X", value: "X", internal: true }],
    settings: { phoneNumber: "0909", adminSecret: "root", bankInfo: { accountNumber: "1" } },
    orders: [{ id: "o" }], customers: [{ id: "c" }], costPrices: [{ productId: "p1", price: 3 }],
    transactions: [], bankInfo: { accountNumber: "1" }, taxRate: { rate: 8 }, shopTemplates: [{ id: "t" }],
  };
  return {
    SESSION_SIGNING_SECRET: "sign", TK_ADMIN: "admin", MK_ADMIN: "pw", ALLOWED_ORIGINS: "",
    LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
    DB: { async get(key: string) { return key in values ? JSON.stringify(values[key]) : null; }, async put() { throw new Error("must not write"); } },
  };
};

test("legacy /api/data: private keys need admin, public keys are projected, nothing else is readable", async () => {
  const env = legacyEnv();
  for (const key of PRIVATE_DATA_KEYS) {
    for (const headers of [{}, { Authorization: "Bearer forged.token" }, { "X-Admin-Secret": "root" }]) {
      const response = await legacyWorker.fetch(new Request(`https://w.example/api/data/${key}`, { headers }), env, {});
      assert.equal(response.status, 401, `${key} ${JSON.stringify(headers)}`);
    }
    const write = await legacyWorker.fetch(new Request(`https://w.example/api/data/${key}`, { method: "POST", body: "[]" }), env, {});
    assert.equal(write.status, 401);
  }
  for (const key of PUBLIC_READ_KEYS) {
    const response = await legacyWorker.fetch(new Request(`https://w.example/api/data/${key}`), env, {});
    assert.equal(response.status, 200);
    assert.deepEqual(leakedKeys(await response.json()), [], key);
  }
  const products = await (await legacyWorker.fetch(new Request("https://w.example/api/data/products"), env, {})).json() as Array<{ id: string }>;
  assert.deepEqual(products.map((product) => product.id), ["p1"], "archived products are not public");
  for (const key of ["__giaban_mcp_state_v1", "live-kv-pending-v1", "unknown", "..%2Forders"]) {
    const response = await legacyWorker.fetch(new Request(`https://w.example/api/data/${key}`), env, {});
    assert.equal(response.status, 404, key);
  }
});
