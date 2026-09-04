import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext, publicContext } from "../../server/application/giaban.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const env = {
  ADMIN_SECRET: "root",
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "https://giaban.khosihuythao.com",
  DOMAIN_AUTHORITATIVE: "1",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { return undefined; } },
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

  const listed = await handleKshtApi(new Request("https://worker.example/api/data/products"), env, app, publicContext());
  assert.equal(listed.status, 200);
  const products = await listed.json() as Array<{ variants: object[] }>;
  assert.equal("costPrice" in products[0].variants[0], false);

  const written = await handleKshtApi(
    new Request("https://worker.example/api/data/products", { method: "POST", body: "[]" }),
    env,
    app,
    context,
  );
  assert.equal(written.status, 423);
});

test("legacy sessions cannot merge customers", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const response = await handleKshtApi(
    new Request("https://worker.example/api/v1/customers/merge/preview", {
      method: "POST",
      headers: { authorization: "Bearer session", "content-type": "application/json" },
      body: JSON.stringify({ canonicalCustomerId: "a", sourceCustomerId: "b" }),
    }),
    env,
    app,
    (await import("../../server/application/giaban.ts")).legacyAdminContext(),
  );
  assert.equal(response.status, 403);
});
