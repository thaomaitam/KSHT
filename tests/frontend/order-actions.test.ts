import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";

import { CloudWriteError, mapOrderFromInvoice, type Order, type PaymentRecord } from "../../businessService.ts";
import {
  INCOMPLETE_PAGES_MESSAGE,
  REFUND_CONFIRM_MESSAGE,
  createOrderHistoryActions,
  printShopTemplate,
  type OrderHistoryDeps,
} from "../../utils/orderActions.ts";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const summary = (id = "ord_1"): Order => ({
  id,
  customerId: "cus_1",
  customerName: "Lan",
  phone: "0901",
  address: "",
  items: [],
  total: 1000,
  status: "confirmed",
  createdAt: "2026-01-02T00:00:00.000Z",
  paymentMethod: "cod",
  outstanding: 1000,
  netCollected: 0,
});

const invoiceOf = (id = "ord_1"): Order => ({
  ...summary(id),
  address: "Q1",
  items: [{ name: "Cọ", unit: "Cây", quantity: 1, unitPrice: 1000, total: 1000 }],
  sellerSnapshot: { id: "tpl_old", name: "Kho cũ", address: "Q1", phone: "0900" },
});

const paymentOf = (id: string, orderId: string, remaining = 1000): PaymentRecord => ({
  id,
  orderId,
  amount: remaining,
  reversedAmount: 0,
  refundedAmount: 0,
  remaining,
  method: "cash",
  createdAt: "2026-01-02T00:00:00.000Z",
});

const controller = (overrides: Partial<OrderHistoryDeps> = {}) =>
  createOrderHistoryActions({
    getOrderInvoice: async (id) => invoiceOf(id),
    recordPayment: async () => paymentOf("pay_1", "ord_1"),
    refundPayment: async () => paymentOf("pay_1", "ord_1", 0),
    listPayments: async () => ({ items: [], truncated: false }),
    ...overrides,
  });

test("print and recreate fetch invoice detail and reject empty summaries", async () => {
  const requested: string[] = [];
  const actions = controller({
    getOrderInvoice: async (id) => {
      requested.push(id);
      return invoiceOf(id);
    },
  });

  const printed = await actions.loadInvoiceForPrint(summary("ord_1"));
  const recreated = await actions.loadInvoiceForRecreate(summary("ord_1"));
  assert.deepEqual(requested, ["ord_1", "ord_1"]);
  assert.equal(printed?.items.length, 1);
  assert.equal(printed?.items[0].name, "Cọ");
  assert.equal(recreated?.items.length, 1);
  assert.notEqual(printed?.items.length, summary().items.length);
});

test("invoice fetch errors surface on notice and do not fall back to the summary", async () => {
  const actions = controller({
    getOrderInvoice: async () => {
      throw new CloudWriteError("không đọc hóa đơn", { code: "INTERNAL_ERROR", retryable: true });
    },
  });
  const printed = await actions.loadInvoiceForPrint(summary());
  assert.equal(printed, null);
  assert.match(actions.snapshot().notice?.message || "", /không đọc hóa đơn/i);

  const emptyActions = controller({
    getOrderInvoice: async (id) => summary(id),
  });
  const empty = await emptyActions.loadInvoiceForRecreate(summary());
  assert.equal(empty, null);
  assert.match(emptyActions.snapshot().notice?.message || "", /chi tiết|hóa đơn|hoá đơn/i);
});

test("print uses frozen sellerSnapshot rather than the current mutable template", () => {
  const liveName = "Mẫu đang sửa";
  const mapped = mapOrderFromInvoice({
    id: "ord_1",
    customerId: "cus_1",
    contact: { name: "Lan", phone: "0901", address: "Q1" },
    items: [{ name: "Cọ", unit: "Cây", quantity: 1, unitPrice: 1000, saleSubtotal: 1000, total: 1000 }],
    status: "confirmed",
    total: 1000,
    outstanding: 0,
    netCollected: 1000,
    shippingFee: 0,
    discount: 0,
    revision: 2,
    createdAt: "2026-01-02T00:00:00.000Z",
    paymentMethod: "cod",
    sellerSnapshot: { id: "tpl_old", name: "Kho cũ", address: "Q1", phone: "0900" },
  });
  const template = printShopTemplate(mapped);
  assert.equal(template.name, "Kho cũ");
  assert.notEqual(template.name, liveName);
  assert.equal(printShopTemplate(summary()).name.includes("Mẫu đang sửa"), false);
  assert.match(printShopTemplate(summary()).name, /Chưa có mẫu/);
});

test("double-click does not start a second in-flight action", async () => {
  const hold = deferred<string>();
  const actions = controller();
  const first = actions.run("confirm", () => hold.promise);
  const second = actions.run("shipping", async () => "nope");
  assert.equal(actions.snapshot().busy, true);
  assert.equal(await second, null);
  hold.resolve("ok");
  assert.equal(await first, "ok");
  assert.equal(actions.snapshot().busy, false);
});

test("run reports errors on notice instead of throwing through the click handler", async () => {
  const actions = controller();
  const result = await actions.run("cancel", async () => {
    throw new CloudWriteError("không hủy được", { code: "INVALID_TRANSITION" });
  });
  assert.equal(result, null);
  assert.match(actions.snapshot().notice?.message || "", /không hủy được/i);
});

test("lost payment response retries with the same key and frozen amount", async () => {
  const keys: string[] = [];
  const amounts: number[] = [];
  let failOnce = true;
  const actions = controller({
    recordPayment: async (_orderId, amount, _method, _note, key) => {
      keys.push(key);
      amounts.push(amount);
      if (failOnce) {
        failOnce = false;
        throw new CloudWriteError("fetch failed", { code: "OFFLINE", status: 0, retryable: true });
      }
      return paymentOf("pay_1", "ord_1");
    },
  });
  await actions.expandOrder("ord_1");
  actions.setPayAmount("5000");
  assert.equal(await actions.recordPayment("ord_1"), null);
  assert.match(actions.snapshot().notice?.message || "", /fetch failed/i);

  actions.setPayAmount("7000");
  assert.equal(await actions.recordPayment("ord_1"), null);
  assert.deepEqual(amounts, [5000]);

  actions.setPayAmount("5000");
  const paid = await actions.recordPayment("ord_1");
  assert.equal(paid?.id, "pay_1");
  assert.deepEqual(amounts, [5000, 5000]);
  assert.equal(keys[0], keys[1]);
});

test("IDENTITY_CONFLICT keeps the payment key so the next click cannot duplicate", async () => {
  const keys: string[] = [];
  const actions = controller({
    recordPayment: async (_orderId, _amount, _method, _note, key) => {
      keys.push(key);
      throw new CloudWriteError("key reuse", { code: "IDENTITY_CONFLICT", retryable: false });
    },
  });
  await actions.expandOrder("ord_1");
  actions.setPayAmount("1000");
  await actions.recordPayment("ord_1");
  actions.setPayAmount("2000");
  await actions.recordPayment("ord_1");
  assert.equal(keys.length, 1);
  actions.setPayAmount("1000");
  await actions.recordPayment("ord_1");
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test("switching expanded orders clears the form and ignores a stale payments response", async () => {
  const lateA = deferred<{ items: PaymentRecord[]; truncated: boolean }>();
  const payA = paymentOf("pay_a", "ord_a");
  const payB = paymentOf("pay_b", "ord_b");
  const refunded: string[] = [];
  const actions = controller({
    listPayments: async (orderId) => {
      if (orderId === "ord_a") return lateA.promise;
      return { items: [payB], truncated: false };
    },
    refundPayment: async (paymentId) => {
      refunded.push(paymentId);
      return { ...payA, remaining: 0 };
    },
  });

  actions.setPayAmount("3000");
  const pendingA = actions.expandOrder("ord_a");
  await actions.expandOrder("ord_b");
  assert.equal(actions.snapshot().expandedId, "ord_b");
  assert.equal(actions.snapshot().payAmount, "");
  assert.equal(actions.snapshot().payments[0]?.id, "pay_b");

  lateA.resolve({ items: [payA], truncated: false });
  await pendingA;
  assert.equal(actions.snapshot().payments[0]?.id, "pay_b");
  assert.equal(await actions.refundRemaining("ord_a", payA, "hoàn nhầm", true), null);
  assert.deepEqual(refunded, []);
});

test("refund requires explicit intent and records money already returned outside the bank", async () => {
  assert.match(REFUND_CONFIRM_MESSAGE, /bên ngoài|đã.*hoàn|đã.*trả/i);
  assert.match(REFUND_CONFIRM_MESSAGE, /không chuyển khoản/i);
  const refunded: string[] = [];
  const pay = paymentOf("pay_1", "ord_1");
  const actions = controller({
    listPayments: async () => ({ items: [pay], truncated: false }),
    refundPayment: async (paymentId) => {
      refunded.push(paymentId);
      return { ...pay, remaining: 0 };
    },
  });
  await actions.expandOrder("ord_1");
  assert.equal(await actions.refundRemaining("ord_1", pay, "khách trả lại", false), null);
  assert.deepEqual(refunded, []);
  assert.equal((await actions.refundRemaining("ord_1", pay, "khách trả lại", true))?.remaining, 0);
  assert.deepEqual(refunded, ["pay_1"]);
});

test("incomplete pages copy is generic and does not claim cursor is missing", () => {
  assert.equal(INCOMPLETE_PAGES_MESSAGE.includes("cursor"), false);
  assert.equal(/\b100\b/.test(INCOMPLETE_PAGES_MESSAGE), false);
  assert.match(INCOMPLETE_PAGES_MESSAGE, /trang/i);
});

test("payment amounts keep exact decimal dong and reject junk rather than truncating", async () => {
  const recorded: number[] = [];
  const actions = controller({
    recordPayment: async (_id, amount) => {
      recorded.push(amount);
      return paymentOf("pay", "ord_1", amount);
    },
  });
  await actions.expandOrder("ord_1");
  for (const amount of ["100abc", "1e3", "0", "-1", "1.1234567", "1000."]) {
    actions.setPayAmount(amount);
    assert.equal(await actions.recordPayment("ord_1"), null);
  }
  assert.deepEqual(recorded, []);
  actions.setPayAmount("7500.5");
  assert.equal((await actions.recordPayment("ord_1"))?.amount, 7500.5);
  assert.deepEqual(recorded, [7500.5]);
});

test("changing expanded order cannot discard an uncertain payment attempt", async () => {
  const keys: string[] = [];
  const actions = controller({ recordPayment: async (_id, _amount, _method, _note, key) => {
    keys.push(key);
    throw new CloudWriteError("Lost response", { code: "OFFLINE", retryable: true });
  } });
  await actions.expandOrder("ord_1");
  actions.setPayAmount("1000");
  await actions.recordPayment("ord_1");
  await actions.expandOrder("ord_2");
  assert.equal(actions.snapshot().expandedId, "ord_1");
  await actions.recordPayment("ord_1");
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});
