import assert from "node:assert/strict";
import test from "node:test";

import {
  stripCostFromProduct,
  toCustomerWrite,
  toDraftOrderWrite,
  toPaymentWrite,
  toProductWrite,
  toReportRangeQuery,
} from "../../client/giabanPayloads.ts";

test("toProductWrite requires name, categoryId, description, image, and integer costPrice variants", () => {
  const payload = toProductWrite({
    name: "Cọ 1 inch",
    categoryId: "cat_1",
    description: "Cán gỗ",
    image: "https://example.com/co.jpg",
    isHot: true,
    variants: [{ size: "1 inch", unit: "Cây", price: 5500, costPrice: 3000 }],
  });
  assert.deepEqual(payload, {
    name: "Cọ 1 inch",
    categoryId: "cat_1",
    description: "Cán gỗ",
    image: "https://example.com/co.jpg",
    isHot: true,
    variants: [{ size: "1 inch", unit: "Cây", price: 5500, costPrice: 3000 }],
  });
  assert.equal(Object.prototype.hasOwnProperty.call(payload.variants[0], "costPrice"), true);
  assert.throws(() => toProductWrite({ name: "", categoryId: "cat_1", description: "", image: "", variants: [] }), /variant/i);
  assert.throws(
    () => toProductWrite({
      name: "Cọ",
      categoryId: "cat_1",
      description: "",
      image: "",
      variants: [{ size: "1", unit: "Cây", price: 1.5, costPrice: 0 }],
    }),
    /integer/i,
  );
});

test("toDraftOrderWrite requires explicit customerId and integer line money", () => {
  const payload = toDraftOrderWrite({
    customerId: "cus_1",
    contactSnapshot: { name: "A", phone: "0901111111", address: "1 Hai Ba Trung" },
    items: [{
      productId: "prd_1",
      name: "Cọ",
      unit: "Cây",
      quantity: 2,
      soCuon: null,
      soKi: null,
      unitPrice: 1000,
      costPrice: 400,
      isManual: false,
    }],
    discount: 0,
    shippingFee: 0,
    note: "",
    paymentMethod: "cod",
  });
  assert.equal(payload.customerId, "cus_1");
  assert.equal(payload.items[0].quantity, 2);
  assert.equal(payload.items[0].costPrice, 400);
  assert.equal("debt" in payload, false);
  assert.throws(() => toDraftOrderWrite({
    customerId: "",
    items: payload.items,
  }), /customerId/);
});

test("toDraftOrderWrite keeps fractional kilograms and unrounded line factors", () => {
  const payload = toDraftOrderWrite({
    customerId: "cus_1",
    items: [{
      name: "Keo",
      unit: "Kg",
      quantity: 1,
      soKi: 0.5,
      unitPrice: 15001,
      costPrice: 4000,
    }],
  });
  assert.equal(payload.items[0].soKi, 0.5);
  assert.equal(payload.items[0].unitPrice, 15001);
  assert.throws(() => toDraftOrderWrite({
    customerId: "cus_1",
    items: [{ name: "Keo", unit: "Kg", quantity: 1, soKi: 0.1234, unitPrice: 1000, costPrice: 0 }],
  }), /decimal/i);
});

test("toPaymentWrite allows partial amounts and contract methods only", () => {
  assert.deepEqual(toPaymentWrite({ amount: 7500.5, method: "cash" }), { amount: 7500.5, method: "cash" });
  assert.deepEqual(toPaymentWrite({ amount: 500, method: "cash" }), { amount: 500, method: "cash" });
  assert.throws(() => toPaymentWrite({ amount: 0, method: "cash" }), /amount/);
  assert.throws(() => toPaymentWrite({ amount: 100, method: "wallet" }), /method/);
});

test("toCustomerWrite requires name, phone, and address", () => {
  assert.deepEqual(
    toCustomerWrite({ name: "Lan", phone: "0901222333", address: "Q1" }),
    { name: "Lan", phone: "0901222333", address: "Q1" },
  );
  assert.throws(() => toCustomerWrite({ name: "Lan", phone: "", address: "Q1" }), /phone/);
});

test("toReportRangeQuery always sends fromDate and toDate", () => {
  assert.equal(toReportRangeQuery("2026-01-01", "2026-01-31"), "fromDate=2026-01-01&toDate=2026-01-31");
});

test("stripCostFromProduct never keeps costPrice on public variants", () => {
  const publicProduct = stripCostFromProduct({
    id: "prd_1",
    name: "Cọ",
    category: "PAINT_BRUSH",
    description: "",
    image: "",
    variants: [{ size: "1", unit: "Cây", price: 5000, costPrice: 2000 }],
  });
  assert.equal("costPrice" in publicProduct.variants[0], false);
  assert.equal(JSON.stringify(publicProduct).includes("costPrice"), false);
});
