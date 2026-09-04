import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { DomainError } from "../../server/domain/errors.ts";
import { SqliteStore } from "../../server/persistence/d1/sqliteStore.ts";

const seeded = async () => {
  const store = new SqliteStore();
  const app = new GiabanApplication(store);
  const context = ownerContext();
  const category = await app.execute({
    operationId: "createCategory",
    input: { label: "Cọ", value: "PAINT" },
  }, { ...context, idempotencyKey: "cat" }) as { id: string };
  const product = await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, { ...context, idempotencyKey: "prd" }) as { id: string };
  const customer = await app.execute({
    operationId: "createCustomer",
    input: { name: "Nguyen Van A", phone: "0901234567", address: "1" },
  }, { ...context, idempotencyKey: "cus" }) as { id: string };
  return { store, app, context, category, product, customer };
};

test("sqlite store survives reload with cost-bearing admin catalog", async () => {
  const { store, product } = await seeded();
  const reopened = new SqliteStore(store.db);
  const app = new GiabanApplication(reopened);
  const listed = await app.query({ operationId: "getProduct", input: { id: product.id } }, ownerContext()) as { variants: Array<{ costPrice: number }> };
  assert.equal(listed.variants[0].costPrice, 400);
});

test("failed command does not persist a partial write", async () => {
  const { store, app, context, customer } = await seeded();
  store.failNextPersist = true;
  await assert.rejects(() => app.execute({
    operationId: "createDraftOrder",
    input: { customerId: customer.id, items: [{ name: "Cọ", unit: "Cây", quantity: 1, soCuon: 1, soKi: 0, unitPrice: 1000, costPrice: 400, isManual: false }] },
  }, { ...context, idempotencyKey: "ord-fail" }));
  const reopened = new SqliteStore(store.db);
  const orders = await new GiabanApplication(reopened).query({ operationId: "listOrders", input: {} }, ownerContext()) as { items: unknown[] };
  assert.equal(orders.items.length, 0);
});

test("revision conflict rolls back sqlite state", async () => {
  const { app, context, product } = await seeded();
  const current = await app.query({ operationId: "getProduct", input: { id: product.id } }, context) as {
    categoryId: string;
    image: string;
    variants: unknown;
    revision: number;
  };
  await app.execute({
    operationId: "updateProduct",
    input: { id: product.id, name: "Cọ 2", categoryId: current.categoryId, description: "d", image: current.image, variants: current.variants },
  }, { ...context, expectedRevision: current.revision, idempotencyKey: "upd-ok" });
  await assert.rejects(() => app.execute({
    operationId: "updateProduct",
    input: { id: product.id, name: "Cọ stale", categoryId: current.categoryId, description: "d", image: current.image, variants: current.variants },
  }, { ...context, expectedRevision: current.revision, idempotencyKey: "upd-stale" }), (error: DomainError) => error.code === "REVISION_CONFLICT");
});
