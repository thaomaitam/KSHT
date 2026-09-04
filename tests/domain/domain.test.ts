import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainError,
  applyConsumption,
  assertCanCancel,
  assertPaymentAllowed,
  assertPublicProjection,
  computeOrderTotals,
  duplicatePhoneWarning,
  effectiveQuantity,
  encodeCursor,
  decodeCursor,
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

test("rejects discount greater than subtotal and unsafe integers", () => {
  assert.throws(() => computeOrderTotals([line], 24001, 0), DomainError);
  assert.throws(() => lineSaleSubtotal({ ...line, unitPrice: 1.5 }), DomainError);
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

test("cursors round-trip", () => {
  const cursor = encodeCursor({ createdAt: "2026-01-01T00:00:00.000Z", id: "ord_1" });
  assert.deepEqual(decodeCursor(cursor), { createdAt: "2026-01-01T00:00:00.000Z", id: "ord_1" });
});
