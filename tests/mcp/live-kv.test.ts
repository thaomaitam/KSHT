import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { LIVE_STATE_KEY, LiveKvStore, type LiveKvNamespace } from "../../workers/mcp/liveKvStore.ts";
import type { SnapshotStorage } from "../../workers/mcp/snapshotStore.ts";
import liveShopWorker from "../../cloudflare_worker.js";

class MemoryCoordinator implements SnapshotStorage {
  values = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class MemoryKv implements LiveKvNamespace {
  values = new Map<string, string>();
  failOnKey: string | null = null;
  readOverrides = new Map<string, string>();

  seed(key: string, value: unknown): void {
    this.values.set(key, JSON.stringify(value));
  }

  json<T = unknown>(key: string): T | null {
    const value = this.values.get(key);
    return value === undefined ? null : JSON.parse(value) as T;
  }

  async get<T = unknown>(key: string, type?: "json"): Promise<T | string | null> {
    const value = this.readOverrides.get(key) ?? this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) as T : value;
  }

  async put(key: string, value: string): Promise<void> {
    if (this.failOnKey === key) throw new Error(`failed ${key}`);
    this.values.set(key, value);
  }
}

const seedLiveShop = (kv: MemoryKv) => {
  kv.seed("categories", [
    { id: "all", label: "Tất cả", value: "ALL" },
    { id: "cat_brush", label: "Cọ sơn", value: "PAINT_BRUSH" },
  ]);
  kv.seed("products", [{
    id: "p_live",
    name: "Cọ live",
    category: "PAINT_BRUSH",
    description: "",
    image: "https://example.test/brush.png",
    internalSupplier: "must-not-be-public",
    variants: [{ size: "1 inch", unit: "Cây", price: 5000, supplierSecret: "must-not-be-public" }],
  }]);
  kv.seed("costPrices", [{ productId: "p_live", price: 3000 }]);
  kv.seed("customers", [{
    id: "c_live",
    name: "Khách A",
    phone: "0901000001",
    address: "HCM",
    totalSpent: 5000,
    lastOrderDate: "2026-09-01T00:00:00.000Z",
  }]);
  kv.seed("orders", [{
    id: "o_live",
    customerId: "c_live",
    customerName: "Khách A",
    phone: "0901000001",
    address: "HCM",
    items: [{ id: "i_live", productId: "p_live", name: "Cọ live", unit: "Cây", quantity: 1, unitPrice: 5000, costPrice: 3000, total: 5000 }],
    total: 5000,
    status: "pending",
    createdAt: "2026-09-01T00:00:00.000Z",
    paymentMethod: "cod",
    paymentStatus: "paid",
  }]);
  kv.seed("transactions", []);
  kv.seed("bankInfo", null);
  kv.seed("taxRate", { rate: 0 });
  kv.seed("shopTemplates", []);
  kv.seed("settings", { phoneNumber: "0909999999", adminSecret: "must-not-be-public" });
};

test("LiveKvStore hydrates the current live KV catalog and order without changing ids", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const store = await LiveKvStore.open(new MemoryCoordinator(), kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);

  const products = await app.query({ operationId: "listProducts", input: {} }, ownerContext()) as { items: Array<{ id: string; variants: Array<{ costPrice: number }> }> };
  const orders = await app.query({ operationId: "listOrders", input: {} }, ownerContext()) as { items: Array<{ id: string; status: string; netCollected: number }> };
  const order = orders.items[0];

  assert.equal(products.items[0].id, "p_live");
  assert.equal(products.items[0].variants[0].costPrice, 3000);
  assert.equal(order.id, "o_live");
  assert.equal(order.status, "confirmed");
  assert.equal(order.netCollected, 5000);
  assert.equal(kv.values.has(LIVE_STATE_KEY), false, "read-only hydration must not mutate live KV");
});

test("catalog mutations publish the legacy storefront shape without cost prices", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const store = await LiveKvStore.open(new MemoryCoordinator(), kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);
  await app.execute({
    operationId: "createProduct",
    input: {
      name: "Rulo mới",
      categoryId: "cat_brush",
      description: "",
      image: "https://example.test/roller.png",
      variants: [{ size: "10 cm", unit: "Cây", price: 9000, costPrice: 6000 }],
    },
  }, ownerContext({ idempotencyKey: "create-live-product" }));
  await app.execute({ operationId: "updatePhoneSettings", input: { phoneNumber: "0909999998" } }, ownerContext({
    idempotencyKey: "clean-public-settings",
    expectedRevision: 1,
  }));

  const storefrontResponse = await liveShopWorker.fetch(new Request("https://api.example.test/api/data/products", {
    headers: { Origin: "https://giaban.khosihuythao.com" },
  }), { DB: kv, ALLOWED_ORIGINS: "https://giaban.khosihuythao.com" } as never, {});
  const products = await storefrontResponse.json() as Array<Record<string, unknown>>;
  const created = products.find((product) => product.name === "Rulo mới") as { category?: string; variants?: Array<Record<string, unknown>> };
  const privateCosts = kv.json<Array<{ productId: string; variants?: unknown[] }>>("costPrices") ?? [];

  assert.equal(created.category, "PAINT_BRUSH");
  assert.equal(storefrontResponse.status, 200);
  assert.equal("costPrice" in (created.variants?.[0] ?? {}), false);
  assert.equal(products.some((product) => "internalSupplier" in product), false);
  assert.equal(products.some((product) => Array.isArray(product.variants) && product.variants.some((variant) => "supplierSecret" in variant)), false);
  assert.deepEqual(kv.json("settings"), { phoneNumber: "0909999998", revision: 2 });
  assert.equal(privateCosts.some((entry) => Array.isArray(entry.variants)), true);
  assert.equal(kv.values.has(LIVE_STATE_KEY), true);
});

test("order and payment mutations update the same legacy KV documents used by admin", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const store = await LiveKvStore.open(new MemoryCoordinator(), kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);
  const draft = await app.execute({
    operationId: "createDraftOrder",
    input: {
      customerId: "c_live",
      items: [{
        id: "new_line",
        productId: "p_live",
        name: "Cọ live",
        unit: "Cây",
        quantity: 2,
        soCuon: null,
        soKi: null,
        unitPrice: 5000,
        costPrice: 3000,
        isManual: false,
      }],
      discount: 0,
      shippingFee: 0,
      paymentMethod: "cod",
    },
  }, ownerContext({ idempotencyKey: "create-live-order" })) as { id: string; revision: number };
  const confirmed = await app.execute({ operationId: "confirmOrder", input: { id: draft.id } }, ownerContext({ expectedRevision: draft.revision })) as { revision: number };
  await app.execute({
    operationId: "recordPayment",
    input: { orderId: draft.id, amount: 10000, method: "cash" },
  }, ownerContext({ idempotencyKey: "pay-live-order", expectedRevision: confirmed.revision }));

  const orders = kv.json<Array<{ id: string; status: string; paymentStatus: string; total: number }>>("orders") ?? [];
  const customers = kv.json<Array<{ id: string; totalSpent: number; debt: number }>>("customers") ?? [];
  const projectedOrder = orders.find((order) => order.id === draft.id);
  const projectedCustomer = customers.find((customer) => customer.id === "c_live");
  assert.equal(projectedOrder?.status, "pending");
  assert.equal(projectedOrder?.paymentStatus, "paid");
  assert.equal(projectedOrder?.total, 10000);
  assert.equal(projectedCustomer?.totalSpent, 15000);
  assert.equal(projectedCustomer?.debt, 0);
});

test("ambiguous legacy debt and customer links block financial writes without blocking catalog", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const legacyOrders = kv.json<Array<Record<string, unknown>>>("orders") ?? [];
  delete legacyOrders[0].customerId;
  legacyOrders[0].debt = 1000;
  kv.seed("orders", legacyOrders);
  const store = await LiveKvStore.open(new MemoryCoordinator(), kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);

  const status = await app.query({ operationId: "getStatus", input: {} }, ownerContext()) as { migrationReady: boolean; migrationBlockerCount: number };
  assert.equal(status.migrationReady, false);
  assert.equal(status.migrationBlockerCount, 2);
  await assert.rejects(
    () => app.execute({ operationId: "createCustomer", input: { name: "B", phone: "0902", address: "HN" } }, ownerContext({ idempotencyKey: "blocked-customer" })),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "MIGRATION_READ_ONLY"),
  );
  await app.execute({
    operationId: "createProduct",
    input: { name: "Catalog vẫn an toàn", categoryId: "cat_brush", description: "", image: "", variants: [{ size: "1", unit: "Cái", price: 1000, costPrice: 500 }] },
  }, ownerContext({ idempotencyKey: "catalog-with-finance-blocker" }));

  assert.equal((kv.json<Array<Record<string, unknown>>>("orders") ?? [])[0].customerId, undefined);
  assert.equal((kv.json<Array<{ name: string }>>("products") ?? []).some((product) => product.name === "Catalog vẫn an toàn"), true);
});

test("missing and duplicate record ids block projection instead of deleting legacy rows", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const malformed = kv.json<Array<Record<string, unknown>>>("products") ?? [];
  malformed.push({ ...malformed[0], name: "ID trùng" }, { name: "Thiếu ID", category: "PAINT_BRUSH", variants: [{ size: "1", unit: "Cái", price: 1000 }] });
  kv.seed("products", malformed);
  const before = kv.values.get("products");
  const store = await LiveKvStore.open(new MemoryCoordinator(), kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);

  await assert.rejects(
    () => app.execute({
      operationId: "createProduct",
      input: { name: "Không được ghi", categoryId: "cat_brush", description: "", image: "", variants: [{ size: "1", unit: "Cái", price: 1000, costPrice: 500 }] },
    }, ownerContext({ idempotencyKey: "blocked-malformed-products" })),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "MIGRATION_READ_ONLY"),
  );
  assert.equal(kv.values.get("products"), before);
});

test("a partial KV publish is journaled and rolled forward before an unrelated mutation", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const coordinator = new MemoryCoordinator();
  const store = await LiveKvStore.open(coordinator, kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);
  kv.failOnKey = "products";

  await assert.rejects(() => app.execute({
    operationId: "createProduct",
    input: {
      name: "Sản phẩm retry",
      categoryId: "cat_brush",
      description: "",
      image: "https://example.test/retry.png",
      variants: [{ size: "1", unit: "Cái", price: 1000, costPrice: 500 }],
    },
  }, ownerContext({ idempotencyKey: "retry-live-product" })));

  kv.failOnKey = null;
  await app.execute({ operationId: "createCategory", input: { label: "Khác", value: "OTHER" } }, ownerContext({ idempotencyKey: "unrelated-after-failure" }));
  const reopened = await LiveKvStore.open(coordinator, kv, { minimumWriteIntervalMs: 0 });
  const products = await new GiabanApplication(reopened).query({ operationId: "listProducts", input: {} }, ownerContext()) as { items: Array<{ name: string }> };
  const reopenedStatus = await new GiabanApplication(reopened).query({ operationId: "getStatus", input: {} }, ownerContext()) as { migrationReady: boolean };
  assert.equal(products.items.some((product) => product.name === "Sản phẩm retry"), true);
  assert.equal((kv.json<Array<{ name: string }>>("products") ?? []).some((product) => product.name === "Sản phẩm retry"), true);
  assert.equal((kv.json<Array<{ value: string }>>("categories") ?? []).some((category) => category.value === "OTHER"), true);
  assert.equal(reopenedStatus.migrationReady, true);
});

test("external legacy KV changes cannot displace the strongly committed MCP snapshot", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const coordinator = new MemoryCoordinator();
  const store = await LiveKvStore.open(coordinator, kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);
  await app.execute({
    operationId: "createProduct",
    input: { name: "Từ MCP", categoryId: "cat_brush", description: "", image: "", variants: [{ size: "1", unit: "Cái", price: 1000, costPrice: 500 }] },
  }, ownerContext({ idempotencyKey: "establish-canonical" }));

  const externallyChanged = kv.json<Array<Record<string, unknown>>>("products") ?? [];
  externallyChanged.push({ id: "p_external", name: "Từ web admin", category: "PAINT_BRUSH", variants: [{ size: "1", unit: "Cái", price: 2000 }] });
  kv.seed("products", externallyChanged);
  const reopened = await LiveKvStore.open(coordinator, kv, { minimumWriteIntervalMs: 0 });
  const reopenedApp = new GiabanApplication(reopened);
  const listed = await reopenedApp.query({ operationId: "listProducts", input: {} }, ownerContext()) as { items: Array<{ id: string }> };
  const status = await reopenedApp.query({ operationId: "getStatus", input: {} }, ownerContext()) as { migrationReady: boolean };

  assert.equal(listed.items.some((product) => product.id === "p_external"), false);
  assert.equal(listed.items.some((product) => product.id !== "p_live"), true);
  assert.equal(status.migrationReady, false);
  await assert.rejects(
    () => reopenedApp.execute({ operationId: "createCategory", input: { label: "Bị chặn", value: "BLOCKED" } }, ownerContext({ idempotencyKey: "blocked-after-external-change" })),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "MIGRATION_READ_ONLY"),
  );
});

test("stale KV reads after restart cannot roll back a strongly committed MCP mutation", async () => {
  const kv = new MemoryKv();
  seedLiveShop(kv);
  const staleProducts = kv.values.get("products") as string;
  const coordinator = new MemoryCoordinator();
  const store = await LiveKvStore.open(coordinator, kv, { minimumWriteIntervalMs: 0 });
  const app = new GiabanApplication(store);
  const created = await app.execute({
    operationId: "createProduct",
    input: { name: "Đã commit", categoryId: "cat_brush", description: "", image: "", variants: [{ size: "1", unit: "Cái", price: 1000, costPrice: 500 }] },
  }, ownerContext({ idempotencyKey: "strong-commit" })) as { id: string };

  kv.readOverrides.set("products", staleProducts);
  const reopened = await LiveKvStore.open(coordinator, kv, { minimumWriteIntervalMs: 0 });
  const reopenedApp = new GiabanApplication(reopened);
  const listed = await reopenedApp.query({ operationId: "listProducts", input: {} }, ownerContext()) as { items: Array<{ id: string }> };
  assert.equal(listed.items.some((product) => product.id === created.id), true);
  await assert.rejects(
    () => reopenedApp.execute({ operationId: "createCategory", input: { label: "Chờ KV", value: "WAIT" } }, ownerContext({ idempotencyKey: "wait-for-kv" })),
    (error: unknown) => Boolean(error && typeof error === "object" && "code" in error && error.code === "MIGRATION_READ_ONLY"),
  );

  kv.readOverrides.clear();
  await reopened.refreshConsistency();
  await reopenedApp.execute({ operationId: "createCategory", input: { label: "KV đã đồng bộ", value: "SYNCED" } }, ownerContext({ idempotencyKey: "kv-synced" }));
  assert.equal((kv.json<Array<{ value: string }>>("categories") ?? []).some((category) => category.value === "SYNCED"), true);
});
