import assert from "node:assert/strict";
import test from "node:test";

import { importKvSnapshot } from "../../scripts/migration/importSnapshot.ts";
import { reconcileCounts } from "../../scripts/migration/reconcile.ts";
import { transformKvSnapshot } from "../../scripts/migration/transform.ts";
import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

test("KV snapshot maps costPrices onto variants and keeps customer ids", () => {
  const result = transformKvSnapshot({
    products: [{ id: "p1", name: "Cọ", category: "PAINT", variants: [{ size: "1", unit: "Cây", price: 1000 }] }],
    costPrices: { p1: 400 },
    customers: [{ id: "c1", name: "A", phone: "0901", address: "x" }],
    orders: [{ id: "o1", customerId: "c1", customerName: "A", phone: "0901", items: [] }],
  });
  assert.equal(result.products[0].variants[0].costPrice, 400);
  assert.equal(result.customers[0].id, "c1");
  assert.equal(result.orders[0].customerId, "c1");
  assert.equal(result.orders[0].status, "draft");
});

test("importing a KV snapshot into the application is reproducible", async () => {
  const snapshot = {
    categories: [{ id: "PAINT", label: "Cọ", value: "PAINT" }],
    products: [{ id: "p1", name: "Cọ", category: "PAINT", variants: [{ size: "1", unit: "Cây", price: 1000 }] }],
    costPrices: { p1: 400 },
    customers: [{ id: "c1", name: "A", phone: "0901234567", address: "x" }],
  };
  const firstStore = new MemoryStore();
  const secondStore = new MemoryStore();
  const first = await importKvSnapshot(firstStore, snapshot);
  const second = await importKvSnapshot(secondStore, snapshot);
  assert.deepEqual(first, second);
  const listed = await new GiabanApplication(firstStore).query({ operationId: "listProducts", input: {} }, ownerContext()) as { items: Array<{ variants: Array<{ costPrice: number }> }> };
  assert.equal(listed.items[0].variants[0].costPrice, 400);
  const listedCustomers = await new GiabanApplication(firstStore).query({ operationId: "listCustomers", input: {} }, ownerContext()) as { items: unknown[] };
  const listedCategories = await new GiabanApplication(firstStore).query({ operationId: "listCategories", input: {} }, ownerContext()) as { items: unknown[] };
  const report = reconcileCounts(first, {
    products: listed.items.length,
    categories: listedCategories.items.length,
    customers: listedCustomers.items.length,
    orders: 0,
    warnings: first.warnings,
  });
  assert.equal(report.ok, true);
});
