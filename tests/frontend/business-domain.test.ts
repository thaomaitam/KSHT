import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";

import {
  historicalReviewFromStatus,
  mapOrderFromInvoice,
  requireCustomerId,
} from "../../businessService.ts";

test("order mapping keeps draft/confirmed/shipping/completed/cancelled and does not invent pending", () => {
  const order = mapOrderFromInvoice({
    id: "ord_1",
    customerId: "cus_1",
    contact: { name: "Lan", phone: "0901", address: "Q1" },
    items: [{ name: "Cọ", unit: "Cây", quantity: 1, unitPrice: 1000, costPrice: 400, saleSubtotal: 1000, total: 1000 }],
    status: "confirmed",
    total: 1000,
    outstanding: 400,
    netCollected: 600,
    shippingFee: 0,
    discount: 0,
    revision: 2,
    createdAt: "2026-01-02T00:00:00.000Z",
    paymentMethod: "cod",
  });
  assert.equal(order.status, "confirmed");
  assert.equal(order.customerId, "cus_1");
  assert.equal(order.netCollected, 600);
  assert.equal(order.outstanding, 400);
  assert.equal("pending" in { [order.status]: true }, false);
});

test("requireCustomerId rejects fuzzy auto-match", () => {
  assert.equal(requireCustomerId("cus_1"), "cus_1");
  assert.throws(() => requireCustomerId(""), /customerId/);
  assert.throws(() => requireCustomerId(undefined), /customerId/);
});

test("historical review stays explicit and is not treated as repaired identity or money", () => {
  const review = historicalReviewFromStatus({
    ok: true,
    migrationReady: false,
    migrationBlockerCount: 331,
    migrationBlockerSummary: [
      { type: "customer_id_requires_review", count: 200 },
      { type: "legacy_total_or_debt_requires_review", count: 131 },
    ],
  });
  assert.equal(review.ready, false);
  assert.equal(review.count, 331);
  assert.equal(review.canRepair, false);
  assert.match(review.message, /không tự sửa/i);
});
