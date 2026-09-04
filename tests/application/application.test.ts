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
