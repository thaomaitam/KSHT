import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { DomainError } from "../../server/domain/errors.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const app = () => new GiabanApplication(new MemoryStore());

const line = {
  name: "Cọ 1 inch",
  unit: "Cây",
  quantity: 2,
  soCuon: 1,
  soKi: 0,
  unitPrice: 1000,
  costPrice: 400,
  isManual: false,
};

const seedCatalog = async (giaban: GiabanApplication) => {
  const context = ownerContext();
  const category = await giaban.execute({
    operationId: "createCategory",
    input: { label: "Cọ sơn", value: "PAINT_BRUSH" },
  }, { ...context, idempotencyKey: "cat-1" });
  const product = await giaban.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "demo",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1 inch", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, { ...context, idempotencyKey: "prd-1" });
  const customer = await giaban.execute({
    operationId: "createCustomer",
    input: { name: "Nguyen Van A", phone: "0901234567", address: "1 Le Loi" },
  }, { ...context, idempotencyKey: "cus-1" });
  return { category, product, customer, context };
};

test("public products never include costPrice", async () => {
  const giaban = app();
  const { product } = await seedCatalog(giaban);
  const listed = await giaban.query({ operationId: "listPublicProducts", input: {} }, ownerContext());
  assert.equal("costPrice" in listed.items[0].variants[0], false);
  const detail = await giaban.query({ operationId: "getPublicProduct", input: { id: product.id } }, ownerContext());
  assert.equal("costPrice" in detail.variants[0], false);
});

test("admin product includes cost and masked customer list hides PII", async () => {
  const giaban = app();
  const { product, customer } = await seedCatalog(giaban);
  const adminProduct = await giaban.query({ operationId: "getProduct", input: { id: product.id } }, ownerContext());
  assert.equal(adminProduct.variants[0].costPrice, 400);
  const customers = await giaban.query({ operationId: "listCustomers", input: {} }, ownerContext());
  assert.equal(customers.items[0].phoneMasked.endsWith("4567"), true);
  assert.equal("phone" in customers.items[0], false);
  const denied = ownerContext({ scopes: ["customers:read"] });
  giaban.store.state.principals.get("principal_owner")!.scopes = ["customers:read"];
  await assert.rejects(
    () => giaban.query({ operationId: "getCustomer", input: { id: customer.id } }, denied),
    DomainError,
  );
});

test("idempotent create replays and conflicting payload fails", async () => {
  const giaban = app();
  const context = ownerContext({ idempotencyKey: "same" });
  const first = await giaban.execute({
    operationId: "createCustomer",
    input: { name: "A", phone: "0901111111", address: "x" },
  }, context);
  const second = await giaban.execute({
    operationId: "createCustomer",
    input: { name: "A", phone: "0901111111", address: "x" },
  }, context);
  assert.equal(first.id, second.id);
  await assert.rejects(
    () => giaban.execute({
      operationId: "createCustomer",
      input: { name: "B", phone: "0901111111", address: "x" },
    }, context),
    (error: DomainError) => error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("stale product revision conflicts", async () => {
  const giaban = app();
  const { product, context } = await seedCatalog(giaban);
  await giaban.execute({
    operationId: "updateProduct",
    input: { id: product.id, name: "Cọ 2", categoryId: product.categoryId, description: "d", image: product.image, variants: product.variants },
  }, { ...context, expectedRevision: 1, idempotencyKey: "upd-1" });
  await assert.rejects(
    () => giaban.execute({
      operationId: "updateProduct",
      input: { id: product.id, name: "Cọ 3", categoryId: product.categoryId, description: "d", image: product.image, variants: product.variants },
    }, { ...context, expectedRevision: 1, idempotencyKey: "upd-2" }),
    (error: DomainError) => error.code === "REVISION_CONFLICT",
  );
});

test("order lifecycle, payment, refund, and cancellation guard", async () => {
  const giaban = app();
  const { customer, context } = await seedCatalog(giaban);
  const draft = await giaban.execute({
    operationId: "createDraftOrder",
    input: { customerId: customer.id, items: [line], discount: 0, shippingFee: 0 },
  }, { ...context, idempotencyKey: "ord-1" });
  assert.equal(draft.status, "draft");
  assert.equal(draft.total, 2000);
  const confirmed = await giaban.execute({
    operationId: "confirmOrder",
    input: { id: draft.id },
  }, { ...context, expectedRevision: 1, idempotencyKey: "ord-2" });
  await giaban.execute({
    operationId: "recordPayment",
    input: { orderId: confirmed.id, amount: 2000, method: "cash" },
  }, { ...context, idempotencyKey: "pay-1" });
  const preview = await giaban.preview({
    operationId: "previewOrderCancellation",
    input: { id: confirmed.id, reason: "khach huy" },
  }, context);
  assert.equal(preview.blockers.length > 0, true);
  const payments = await giaban.query({ operationId: "listPayments", input: { orderId: confirmed.id } }, context);
  const refundPreview = await giaban.preview({
    operationId: "previewPaymentRefund",
    input: { paymentId: payments.items[0].id, amount: 2000, reason: "tra tien mat" },
  }, context);
  await giaban.confirm({
    operationId: "confirmPaymentRefund",
    input: { confirmationToken: refundPreview.confirmationToken },
  }, context);
  const cancelPreview = await giaban.preview({
    operationId: "previewOrderCancellation",
    input: { id: confirmed.id, reason: "khach huy" },
  }, context);
  const cancelled = await giaban.confirm({
    operationId: "confirmOrderCancellation",
    input: { confirmationToken: cancelPreview.confirmationToken },
  }, context);
  assert.equal(cancelled.status, "cancelled");
});

test("draft order keeps fractional kilogram money without rounding to whole dong", async () => {
  const giaban = app();
  const { customer, context } = await seedCatalog(giaban);
  const draft = await giaban.execute({
    operationId: "createDraftOrder",
    input: {
      customerId: customer.id,
      items: [{
        name: "Keo",
        unit: "Kg",
        quantity: 1,
        soCuon: null,
        soKi: 0.5,
        unitPrice: 15001,
        costPrice: 4000,
        isManual: true,
      }],
      discount: 0,
      shippingFee: 0,
    },
  }, { ...context, idempotencyKey: "ord-kg-1" });
  assert.equal(draft.items[0].soKi, 0.5);
  assert.equal(draft.items[0].effectiveQuantity, 0.5);
  assert.equal(draft.items[0].saleSubtotal, 7500.5);
  assert.equal(draft.total, 7500.5);
  const paid = await giaban.execute({
    operationId: "recordPayment",
    input: { orderId: draft.id, amount: 7500.5, method: "cash" },
  }, { ...context, idempotencyKey: "pay-kg-1" });
  assert.equal(paid.amount, 7500.5);
  const invoice = await giaban.query({ operationId: "getOrderInvoice", input: { id: draft.id } }, context);
  assert.equal(invoice.outstanding, 0);
  assert.equal(invoice.netCollected, 7500.5);
});

test("legacy sessions cannot merge customers", async () => {
  const giaban = app();
  await seedCatalog(giaban);
  await assert.rejects(
    () => giaban.preview({
      operationId: "previewCustomerMerge",
      input: { canonicalCustomerId: "x", sourceCustomerId: "y" },
    }, ownerContext({ legacy: true })),
    (error: DomainError) => error.code === "FORBIDDEN",
  );
});

test("customer merge remaps orders and unmerge uses lineage", async () => {
  const giaban = app();
  const { customer, context } = await seedCatalog(giaban);
  const other = await giaban.execute({
    operationId: "createCustomer",
    input: { name: "Nguyen Van B", phone: "0909999999", address: "2" },
  }, { ...context, idempotencyKey: "cus-2" });
  const draft = await giaban.execute({
    operationId: "createDraftOrder",
    input: { customerId: other.id, items: [line] },
  }, { ...context, idempotencyKey: "ord-m" });
  const preview = await giaban.preview({
    operationId: "previewCustomerMerge",
    input: { canonicalCustomerId: customer.id, sourceCustomerId: other.id },
  }, context);
  await giaban.confirm({
    operationId: "confirmCustomerMerge",
    input: { confirmationToken: preview.confirmationToken },
  }, context);
  const order = await giaban.query({ operationId: "getOrderInvoice", input: { id: draft.id } }, context);
  assert.equal(order.customerId, customer.id);
  const eventId = [...giaban.store.state.mergeEvents.keys()][0];
  const unmergePreview = await giaban.preview({
    operationId: "previewCustomerUnmerge",
    input: { mergeEventId: eventId },
  }, context);
  const restored = await giaban.confirm({
    operationId: "confirmCustomerUnmerge",
    input: { confirmationToken: unmergePreview.confirmationToken },
  }, context);
  assert.equal(restored.id, other.id);
  assert.equal(restored.mergedIntoId, null);
});

test("reports use backend formula and expired confirmation fails closed", async () => {
  const giaban = app();
  const { customer, context } = await seedCatalog(giaban);
  const draft = await giaban.execute({
    operationId: "createDraftOrder",
    input: { customerId: customer.id, items: [line], discount: 200, shippingFee: 500 },
  }, { ...context, idempotencyKey: "rep-1" });
  await giaban.execute({ operationId: "confirmOrder", input: { id: draft.id } }, { ...context, expectedRevision: 1, idempotencyKey: "rep-2" });
  const summary = await giaban.query({
    operationId: "getReportSummary",
    input: { fromDate: "2026-09-01", toDate: "2026-09-30" },
  }, context);
  assert.equal(summary.confirmedSales, 2300);
  assert.equal(summary.cogs, 800);
  assert.equal(summary.profit, 1500);
  const stale = ownerContext({ now: new Date("2026-09-04T00:20:00.000Z") });
  giaban.store.state.confirmations.set("cnf_old", {
    token: "cnf_old",
    principalId: stale.principalId,
    clientId: "unknown",
    operationId: "previewBackupExport",
    payloadHash: "{}",
    scopes: stale.scopes,
    targetIds: [],
    expectedRevisions: {},
    impactSummary: "x",
    input: {},
    expiresAt: "2026-09-04T00:10:00.000Z",
    consumedAt: null,
  });
  await assert.rejects(
    () => giaban.confirm({ operationId: "confirmBackupExport", input: { confirmationToken: "cnf_old" } }, stale),
    (error: DomainError) => error.code === "CONFIRMATION_EXPIRED",
  );
});

const seedListedProducts = (giaban: GiabanApplication, count: number) => {
  const generationId = giaban.store.state.generationId;
  const now = "2026-01-01T00:00:00.000Z";
  giaban.store.state.categories.set("cat_a", {
    id: "cat_a", label: "Cọ", value: "PAINT", archived: false, revision: 1, datasetGenerationId: generationId, createdAt: now, updatedAt: now,
  });
  giaban.store.state.categories.set("cat_b", {
    id: "cat_b", label: "Lô", value: "ROLL", archived: false, revision: 1, datasetGenerationId: generationId, createdAt: now, updatedAt: now,
  });
  for (let index = 0; index < count; index += 1) {
    const id = index === 0 ? "prd_đơn_cọ" : `prd_${String(index).padStart(3, "0")}`;
    giaban.store.state.products.set(id, {
      id,
      name: index % 5 === 0 ? `Cọ sơn ${index}` : `Lô giấy ${index}`,
      categoryId: index % 4 === 0 ? "cat_a" : "cat_b",
      description: "demo",
      image: "https://example.invalid/p.png",
      isHot: false,
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
      archived: index === 1,
      revision: 1,
      datasetGenerationId: generationId,
      createdAt: index < 3 ? now : `2026-02-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      updatedAt: now,
    });
  }
};

test("listProducts walks cursor, filters before pagination, and rejects malformed cursors", async () => {
  const giaban = app();
  seedListedProducts(giaban, 210);
  const context = ownerContext();
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let pageNo = 0; pageNo < 20; pageNo += 1) {
    const page = await giaban.query({ operationId: "listProducts", input: { limit: 50, cursor } }, context);
    seen.push(...page.items.map((row: { id: string }) => row.id));
    if (!page.page.hasMore) break;
    cursor = page.page.nextCursor;
  }
  assert.equal(seen.includes("prd_đơn_cọ"), true);
  assert.equal(seen.includes("prd_001"), false);
  assert.equal(new Set(seen).size, 209);
  assert.equal(seen.length, 209);

  const archived = await giaban.query({
    operationId: "listProducts",
    input: { limit: 5, includeArchived: true, q: "prd_001" },
  }, context);
  assert.equal(archived.items.some((row: { id: string; archived: boolean }) => row.id === "prd_001" && row.archived), true);
  const hidden = await giaban.query({
    operationId: "listProducts",
    input: { limit: 5, q: "prd_001" },
  }, context);
  assert.equal(hidden.items.some((row: { id: string }) => row.id === "prd_001"), false);

  const filtered = await giaban.query({
    operationId: "listProducts",
    input: { limit: 10, q: "Cọ sơn", categoryId: "cat_a" },
  }, context);
  assert.equal(filtered.items.length > 0, true);
  const mismatched = filtered.items.filter((row: { name: string; categoryId: string }) => !row.name.includes("Cọ sơn") || row.categoryId !== "cat_a");
  assert.deepEqual(mismatched, []);
  if (filtered.page.hasMore) {
    const next = await giaban.query({
      operationId: "listProducts",
      input: { limit: 10, q: "Cọ sơn", categoryId: "cat_a", cursor: filtered.page.nextCursor },
    }, context);
    assert.equal(next.items.every((row: { name: string; categoryId: string }) => row.name.includes("Cọ sơn") && row.categoryId === "cat_a"), true);
    assert.equal(next.items.some((row: { id: string }) => filtered.items.some((first: { id: string }) => first.id === row.id)), false);
  }

  await assert.rejects(
    () => giaban.query({ operationId: "listProducts", input: { cursor: "not-a-cursor" } }, context),
    (error: DomainError) => error.code === "VALIDATION_ERROR",
  );
});

test("listPublicProducts and listCustomers honor cursor after filters", async () => {
  const giaban = app();
  seedListedProducts(giaban, 120);
  const context = ownerContext();
  const first = await giaban.query({ operationId: "listPublicProducts", input: { limit: 40, categoryId: "cat_b" } }, context);
  assert.equal(first.items.length, 40);
  assert.equal(first.page.hasMore, true);
  const second = await giaban.query({
    operationId: "listPublicProducts",
    input: { limit: 40, categoryId: "cat_b", cursor: first.page.nextCursor },
  }, context);
  assert.equal(second.items.some((row: { id: string }) => first.items.some((item: { id: string }) => item.id === row.id)), false);
  assert.equal("costPrice" in second.items[0].variants[0], false);

  const generationId = giaban.store.state.generationId;
  for (let index = 0; index < 120; index += 1) {
    const id = `cus_${String(index).padStart(3, "0")}`;
    giaban.store.state.customers.set(id, {
      id,
      name: index % 2 === 0 ? `Lan ${index}` : `Minh ${index}`,
      phone: `090${String(1000000 + index)}`,
      address: "1",
      archived: false,
      revision: 1,
      mergedIntoId: null,
      datasetGenerationId: generationId,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  }
  const customers = await giaban.query({ operationId: "listCustomers", input: { limit: 30, q: "Lan" } }, context);
  assert.equal(customers.items.length, 30);
  assert.equal(customers.page.hasMore, true);
  const more = await giaban.query({
    operationId: "listCustomers",
    input: { limit: 30, q: "Lan", cursor: customers.page.nextCursor },
  }, context);
  assert.equal(more.items.some((row: { id: string }) => customers.items.some((item: { id: string }) => item.id === row.id)), false);
});

test("confirmOrder idempotency replay precedes stale revision checks", async () => {
  const giaban = app();
  const { customer, context } = await seedCatalog(giaban);
  const draft = await giaban.execute({
    operationId: "createDraftOrder",
    input: { customerId: customer.id, items: [line] },
  }, { ...context, idempotencyKey: "draft-replay" });
  const confirmed = await giaban.execute({
    operationId: "confirmOrder",
    input: { id: draft.id },
  }, { ...context, expectedRevision: 1, idempotencyKey: "confirm-replay" });
  const replayed = await giaban.execute({
    operationId: "confirmOrder",
    input: { id: draft.id },
  }, { ...context, expectedRevision: 1, idempotencyKey: "confirm-replay" });
  assert.equal(replayed.status, "confirmed");
  assert.equal(replayed.revision, confirmed.revision);
  const payment = await giaban.execute({
    operationId: "recordPayment",
    input: { orderId: confirmed.id, amount: 2000, method: "cash" },
  }, { ...context, idempotencyKey: "pay-replay" });
  const paymentReplay = await giaban.execute({
    operationId: "recordPayment",
    input: { orderId: confirmed.id, amount: 2000, method: "cash" },
  }, { ...context, idempotencyKey: "pay-replay" });
  assert.equal(paymentReplay.id, payment.id);
  const listed = await giaban.query({ operationId: "listPayments", input: { orderId: confirmed.id } }, context);
  assert.equal(listed.items.length, 1);
});
