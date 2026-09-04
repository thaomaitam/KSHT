import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { handleApiV1 } from "../../server/http/adapter.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const request = (path: string, init?: RequestInit) => new Request(`https://giaban.example${path}`, init);

test("GET /api/v1/status returns dataset generation", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const response = await handleApiV1(request("/api/v1/status"), app, ownerContext());
  assert.equal(response?.status, 200);
  const body = await response!.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.datasetGenerationId, "string");
  assert.equal(body.migrationDiagnostics.sourceHash, "");
  assert.equal(body.migrationDiagnostics.customerLinks.explicitValidId, 0);
  assert.equal(body.migrationDiagnostics.money.unexplainedTotalMismatch, 0);
});

test("unknown v1 route is 404 and non-v1 is ignored", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const missing = await handleApiV1(request("/api/v1/nope"), app, ownerContext());
  assert.equal(missing?.status, 404);
  const ignored = await handleApiV1(request("/api/data/products"), app, ownerContext());
  assert.equal(ignored, null);
});

test("public products omit costPrice over HTTP", async () => {
  const app = new GiabanApplication(new MemoryStore());
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
  const response = await handleApiV1(request("/api/v1/public/products"), app, ownerContext());
  const body = await response!.json();
  assert.equal("costPrice" in body.items[0].variants[0], false);
});
