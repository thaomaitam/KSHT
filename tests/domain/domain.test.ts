import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainError,
  applyConsumption,
  assertCanCancel,
  assertPaymentAllowed,
  businessDateOnly,
  businessYearStart,
  dayBoundsUtc,
  assertPublicProjection,
  computeOrderTotals,
  duplicatePhoneWarning,
  effectiveQuantity,
  encodeCursor,
  decodeCursor,
  paginate,
  isActiveSaleStatus,
  lineCogs,
  lineSaleSubtotal,
  maskPhone,
  netCollected,
  outstandingForOrder,
  publicProductFromAdmin,
  remainingConsumable,
  summarizeOrders,
  transitionOrder,
} from "../../server/domain/index.ts";

const line = {
  quantity: 2,
  soCuon: 3,
  soKi: 4,
  unitPrice: 1000,
  costPrice: 400,
};

test("effective quantity multiplies only positive soCuon and soKi", () => {
  assert.equal(effectiveQuantity({ quantity: 2, soCuon: 3, soKi: 4 }), 24);
  assert.equal(effectiveQuantity({ quantity: 2, soCuon: 0, soKi: 0 }), 2);
  assert.equal(effectiveQuantity({ quantity: 2 }), 2);
});

test("fractional kilograms keep exact line money without rounding to whole dong", () => {
  assert.equal(effectiveQuantity({ quantity: 1, soKi: 0.5 }), 0.5);
  assert.equal(effectiveQuantity({ quantity: 2, soCuon: 0.5, soKi: 0.5 }), 0.5);
  assert.equal(lineSaleSubtotal({ quantity: 1, soKi: 0.5, unitPrice: 15001, costPrice: 4000 }), 7500.5);
  assert.equal(lineCogs({ quantity: 1, soKi: 0.5, unitPrice: 15001, costPrice: 4000 }), 2000);
  assert.equal(lineSaleSubtotal({ quantity: 1, soKi: 0.1, unitPrice: 15001, costPrice: 0 }), 1500.1);
  const totals = computeOrderTotals([{ quantity: 1, soKi: 0.5, unitPrice: 15001, costPrice: 4000 }], 0.5, 0);
  assert.equal(totals.lineSubtotal, 7500.5);
  assert.equal(totals.discount, 0.5);
  assert.equal(totals.total, 7500);
});

test("quantity factors reject extra decimals instead of rounding kilograms", () => {
  assert.throws(() => effectiveQuantity({ quantity: 1, soKi: 0.1234 }), DomainError);
  assert.throws(() => effectiveQuantity({ quantity: 1, soKi: -0.5 }), DomainError);
  assert.equal(effectiveQuantity({ quantity: 1, soKi: 1.55 }), 1.55);
});

test("line sale and cogs use the same effective quantity", () => {
  assert.equal(lineSaleSubtotal(line), 24000);
  assert.equal(lineCogs(line), 9600);
});

test("order total excludes previous debt", () => {
  const totals = computeOrderTotals([line], 1000, 2000);
  assert.equal(totals.lineSubtotal, 24000);
  assert.equal(totals.discount, 1000);
  assert.equal(totals.shippingFee, 2000);
  assert.equal(totals.total, 25000);
});

test("rejects discount greater than subtotal and invalid money", () => {
  assert.throws(() => computeOrderTotals([line], 24001, 0), DomainError);
  assert.throws(() => lineSaleSubtotal({ ...line, unitPrice: Number.NaN }), DomainError);
  assert.throws(() => lineSaleSubtotal({ ...line, unitPrice: -1 }), DomainError);
});

test("legal lifecycle transitions and forbidden reopen", () => {
  assert.equal(transitionOrder("draft", "confirmed"), "confirmed");
  assert.equal(transitionOrder("confirmed", "shipping"), "shipping");
  assert.equal(transitionOrder("shipping", "completed"), "completed");
  assert.throws(() => transitionOrder("cancelled", "confirmed"), DomainError);
  assert.throws(() => transitionOrder("completed", "cancelled"), DomainError);
  assert.equal(isActiveSaleStatus("draft"), false);
});

test("paid-order cancellation is blocked until net collected is zero", () => {
  assert.throws(() => assertCanCancel("confirmed", 1, "customer request"), DomainError);
  assert.doesNotThrow(() => assertCanCancel("confirmed", 0, "customer request"));
  assert.throws(() => assertCanCancel("confirmed", 0, " "), DomainError);
  assert.throws(() => assertCanCancel("draft", 0, "no"), DomainError);
});

test("payments cannot overpay and remaining cannot be double-consumed", () => {
  assertPaymentAllowed(10000, 4000, 6000, "confirmed");
  assert.throws(() => assertPaymentAllowed(10000, 4000, 6001, "confirmed"), DomainError);
  const payment = { amount: 10000, reversedAmount: 0, refundedAmount: 0 };
  const afterRefund = applyConsumption(payment, "refund", 4000);
  assert.equal(remainingConsumable(afterRefund), 6000);
  const afterBoth = applyConsumption(afterRefund, "reversal", 6000);
  assert.equal(remainingConsumable(afterBoth), 0);
  assert.throws(() => applyConsumption(afterBoth, "refund", 1), DomainError);
});

test("derived outstanding is zero for cancelled orders", () => {
  assert.equal(outstandingForOrder(10000, 3000, "confirmed"), 7000);
  assert.equal(outstandingForOrder(10000, 0, "cancelled"), 0);
  assert.equal(netCollected([{ amount: 5000, reversedAmount: 1000, refundedAmount: 500 }]), 3500);
});

test("phone is searchable and masked, never an identity key", () => {
  assert.equal(maskPhone("0901234567"), "******4567");
  assert.equal(duplicatePhoneWarning("0901-234-567", ["0901234567"]), true);
  assert.equal(duplicatePhoneWarning("0901111111", ["0901234567"]), false);
});

test("public product projection cannot contain cost or bank fields", () => {
  const publicProduct = publicProductFromAdmin({
    id: "p1",
    name: "Brush",
    categoryId: "c1",
    description: "x",
    image: "https://example.invalid/a.png",
    variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    revision: 1,
  });
  assert.equal("costPrice" in publicProduct.variants[0], false);
  assert.throws(() => assertPublicProjection({ costPrice: 1 }), DomainError);
  assert.throws(() => assertPublicProjection({ bankName: "x" }), DomainError);
});

test("reports split confirmed sales, receipts, refunds, receivables, and profit", () => {
  const summary = summarizeOrders([
    {
      status: "confirmed",
      discount: 1000,
      shippingFee: 2000,
      lines: [line],
      payments: [{ amount: 10000, reversedAmount: 0, refundedAmount: 2000 }],
    },
    {
      status: "draft",
      discount: 0,
      shippingFee: 0,
      lines: [line],
      payments: [],
    },
  ]);
  assert.equal(summary.confirmedSales, 25000);
  assert.equal(summary.cogs, 9600);
  assert.equal(summary.profit, 15400);
  assert.equal(summary.grossReceipts, 10000);
  assert.equal(summary.refunds, 2000);
  assert.equal(summary.netReceipts, 8000);
  assert.equal(summary.receivables, 17000);
  assert.equal(summary.discounts, 1000);
  assert.equal(summary.shippingFees, 2000);
});

test("report profit and net receipts keep exact fractional dong", () => {
  const summary = summarizeOrders([
    {
      status: "confirmed",
      discount: 0.5,
      shippingFee: 0,
      lines: [{ quantity: 1, soKi: 0.5, unitPrice: 15001, costPrice: 4000 }],
      payments: [{ amount: 7500.5, reversedAmount: 0, refundedAmount: 0.5 }],
    },
  ]);
  assert.equal(summary.confirmedSales, 7500);
  assert.equal(summary.cogs, 2000);
  assert.equal(summary.profit, 5500);
  assert.equal(summary.grossReceipts, 7500.5);
  assert.equal(summary.refunds, 0.5);
  assert.equal(summary.netReceipts, 7500);
  assert.equal(summary.receivables, 0);
});

test("cursors round-trip", () => {
  const cursor = encodeCursor({ createdAt: "2026-01-01T00:00:00.000Z", id: "ord_1" });
  assert.deepEqual(decodeCursor(cursor), { createdAt: "2026-01-01T00:00:00.000Z", id: "ord_1" });
});

const rowsOf = (count: number, createdAt = (index: number) => `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`) =>
  Array.from({ length: count }, (_, index) => ({
    id: `prd_${String(index).padStart(3, "0")}`,
    createdAt: createdAt(index),
    name: `Item ${index}`,
  }));

test("paginate sorts descending createdAt then id and consumes cursor", () => {
  const rows = [
    { id: "prd_a", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "prd_c", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "prd_b", createdAt: "2026-01-02T00:00:00.000Z" },
  ];
  const first = paginate(rows, 2);
  assert.deepEqual(first.items.map((row) => row.id), ["prd_c", "prd_b"]);
  assert.equal(first.page.hasMore, true);
  assert.equal(typeof first.page.nextCursor, "string");
  const second = paginate(rows, 2, first.page.nextCursor);
  assert.deepEqual(second.items.map((row) => row.id), ["prd_a"]);
  assert.equal(second.page.hasMore, false);
  assert.equal(second.page.nextCursor, null);
});

test("paginate walks more than 200 rows including identical timestamps and unicode ids", () => {
  const rows = [
    ...rowsOf(203),
    { id: "prd_đơn_cọ", createdAt: "2026-02-01T00:00:00.000Z" },
    { id: "prd_tie", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let pageNo = 0; pageNo < 20; pageNo += 1) {
    const page = paginate(rows, 50, cursor);
    seen.push(...page.items.map((row) => row.id));
    if (!page.page.hasMore) break;
    cursor = page.page.nextCursor ?? undefined;
  }
  assert.equal(seen.length, 205);
  assert.equal(new Set(seen).size, 205);
  assert.equal(seen.includes("prd_đơn_cọ"), true);
});

test("paginate rejects malformed cursors and returns empty or last pages", () => {
  assert.throws(() => paginate(rowsOf(3), 10, "not-a-cursor"), (error: DomainError) => error.code === "VALIDATION_ERROR");
  assert.throws(() => decodeCursor("%%%"), (error: DomainError) => error.code === "VALIDATION_ERROR");
  const empty = paginate([], 10);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.page.hasMore, false);
  assert.equal(empty.page.nextCursor, null);
  const last = paginate(rowsOf(3), 10);
  assert.equal(last.items.length, 3);
  assert.equal(last.page.hasMore, false);
  assert.equal(last.page.nextCursor, null);
});

test("fractional payments can settle exact kilogram line totals", () => {
  assertPaymentAllowed(7500.5, 0, 7500.5, "confirmed");
  assert.equal(outstandingForOrder(7500.5, 7500.5, "confirmed"), 0);
  assert.equal(netCollected([{ amount: 7500.5, reversedAmount: 0, refundedAmount: 0.5 }]), 7500);
});

test("report business dates use Asia/Ho_Chi_Minh rather than UTC calendar dates", () => {
  const bounds = dayBoundsUtc("2026-09-05");
  assert.equal(bounds.startIso, "2026-09-04T17:00:00.000Z");
  assert.equal(bounds.endIso, "2026-09-05T16:59:59.999Z");
  assert.equal(businessDateOnly(new Date("2026-09-05T16:30:00.000Z")), "2026-09-05");
  assert.equal(businessDateOnly(new Date("2026-09-05T17:30:00.000Z")), "2026-09-06");
  assert.equal(businessYearStart(new Date("2026-09-05T17:30:00.000Z")), "2026-01-01");
});
