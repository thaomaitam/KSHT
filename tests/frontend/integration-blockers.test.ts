import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const draftInvoice = {
  id: "ord_1",
  customerId: "cus_1",
  contact: { name: "Lan", phone: "0901", address: "Q1" },
  items: [{ name: "Cọ", unit: "Cây", quantity: 1, unitPrice: 1000, costPrice: 400, saleSubtotal: 1000, total: 1000 }],
  status: "draft",
  total: 1000,
  outstanding: 1000,
  netCollected: 0,
  shippingFee: 0,
  discount: 0,
  revision: 1,
  createdAt: "2026-01-02T00:00:00.000Z",
  paymentMethod: "cod",
};

test("placeOrder reuses stable step keys after a lost confirm response and blocks payload changes", async () => {
  const keys: string[] = [];
  const paths: string[] = [];
  let confirmCalls = 0;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    paths.push(url);
    const headers = new Headers(init?.headers);
    const key = headers.get("Idempotency-Key") || "";
    if (key) keys.push(`${init?.method || "GET"} ${url} ${key}`);
    if (url.endsWith("/api/v1/orders") && init?.method === "POST") {
      return jsonResponse(201, draftInvoice);
    }
    if (url.includes("/orders/ord_1/confirm")) {
      confirmCalls += 1;
      if (confirmCalls === 1) throw new TypeError("fetch failed");
      return jsonResponse(200, { ...draftInvoice, status: "confirmed", revision: 2 });
    }
    if (url.includes("/payments")) {
      return jsonResponse(201, { id: "pay_1", orderId: "ord_1", amount: 1000, method: "cash" });
    }
    if (url.includes("/orders/ord_1/invoice")) {
      return jsonResponse(200, { ...draftInvoice, status: "confirmed", revision: 2, netCollected: 1000, outstanding: 0 });
    }
    return jsonResponse(404, { code: "NOT_FOUND" });
  };

  const { businessService } = await import("../../businessService.ts");
  const input = {
    customerId: "cus_1",
    customerName: "Lan",
    phone: "0901",
    address: "Q1",
    items: [{ productId: "prd_1", name: "Cọ", quantity: 1, unitPrice: 1000, unit: "Cây" }],
    shippingFee: 0,
    discount: 0,
    note: "",
    paymentMethod: "cod" as const,
    confirm: true,
    collectAmount: 1000,
    idempotencyKey: "op-place-1",
  };
  await assert.rejects(() => businessService.placeOrder(input), (error: { retryable?: boolean }) => error.retryable === true);
  const order = await businessService.placeOrder(input);
  assert.equal(order.status, "confirmed");
  assert.equal(keys.filter((row) => row.endsWith("op-place-1:draft")).length >= 2, true);
  assert.equal(keys.filter((row) => row.endsWith("op-place-1:confirm")).length >= 2, true);
  assert.equal(keys.some((row) => row.endsWith("op-place-1:payment")), true);
  await assert.rejects(
    () => businessService.placeOrder({ ...input, collectAmount: 500 }),
    (error: { code?: string }) => error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("getOrders uses list summaries and does not skip a failed invoice fetch", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/api/v1/orders?") || url.endsWith("/api/v1/orders")) {
      return jsonResponse(200, {
        items: [
          { id: "ord_ok", customerId: "cus_1", customerName: "Lan", phone: "090****", status: "confirmed", total: 1000, createdAt: "2026-01-02T00:00:00.000Z" },
          { id: "ord_fail", customerId: "cus_2", customerName: "Minh", phone: "091****", status: "confirmed", total: 2000, createdAt: "2026-01-01T00:00:00.000Z" },
        ],
        page: { hasMore: false, nextCursor: null, limit: 100 },
      });
    }
    if (url.includes("/invoice")) {
      return jsonResponse(500, { code: "INTERNAL", message: "boom", retryable: true });
    }
    return jsonResponse(404, {});
  };

  const { businessService } = await import("../../businessService.ts");
  const listed = await businessService.getOrders();
  assert.equal(listed.items.length, 2);
  assert.equal(listed.complete, true);
  assert.equal(urls.some((url) => url.includes("/invoice")), false);
  assert.deepEqual(listed.items[0].items, []);

  await assert.rejects(() => businessService.getOrderInvoice("ord_fail"));
});

test("bank and tax loads fail closed and saves keep the fetched revision", async () => {
  globalThis.fetch = async () => jsonResponse(500, { code: "INTERNAL", message: "down", retryable: true });
  const { businessService, CloudWriteError } = await import("../../businessService.ts");
  await assert.rejects(() => businessService.getBankInfo(), (error: unknown) => error instanceof CloudWriteError);
  await assert.rejects(() => businessService.getTaxRate(), (error: unknown) => error instanceof CloudWriteError);

  const revisions: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (headers.get("If-Match-Revision")) revisions.push(`${init?.method} ${url} ${headers.get("If-Match-Revision")}`);
    if (url.includes("/settings/bank") && (!init?.method || init.method === "GET")) {
      return jsonResponse(200, { bankName: "VCB", accountNumber: "1", accountName: "A", qrCodeUrl: "", revision: 4 });
    }
    if (url.includes("/settings/tax") && (!init?.method || init.method === "GET")) {
      return jsonResponse(200, { rate: 8, revision: 7 });
    }
    if (url.includes("/settings/bank")) {
      return jsonResponse(200, { bankName: "VCB", accountNumber: "1", accountName: "A", qrCodeUrl: "", revision: 5 });
    }
    if (url.includes("/settings/tax")) {
      return jsonResponse(200, { rate: 10, revision: 8 });
    }
    return jsonResponse(404, {});
  };

  const bank = await businessService.getBankInfo();
  const tax = await businessService.getTaxRate();
  assert.equal(bank?.revision, 4);
  assert.equal(tax.rate, 8);
  assert.equal(tax.revision, 7);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (headers.get("If-Match-Revision")) revisions.push(`${init?.method} ${url} ${headers.get("If-Match-Revision")}`);
    if (url.includes("/settings/bank") && init?.method && init.method !== "GET") {
      return jsonResponse(200, { bankName: "VCB", accountNumber: "1", accountName: "A", qrCodeUrl: "", revision: 5 });
    }
    if (url.includes("/settings/tax") && init?.method && init.method !== "GET") {
      return jsonResponse(200, { rate: 10, revision: 8 });
    }
    if (url.includes("/settings/bank") || url.includes("/settings/tax")) {
      assert.fail("save must not re-fetch latest revision");
    }
    return jsonResponse(404, {});
  };

  await businessService.saveBankInfo(bank!);
  await businessService.saveTaxRate(10);
  assert.equal(revisions.some((row) => row.endsWith(" 4")), true);
  assert.equal(revisions.some((row) => row.endsWith(" 7")), true);
});

test("admin phone/category loads fail closed and phone saves use the form revision without refetch", async () => {
  const { apiService } = await import("../../apiService.ts");
  const { settingsService } = await import("../../settingsService.ts");
  apiService.setSession("fixture-token", Date.now() + 60_000);
  localStorage.setItem("giaban_settings", JSON.stringify({ phoneNumber: "old", revision: 99 }));
  globalThis.fetch = async () => jsonResponse(500, { code: "INTERNAL", retryable: true });
  await assert.rejects(() => settingsService.getSettings());
  await assert.rejects(() => settingsService.getCategoryLoad());
  await assert.rejects(() => settingsService.saveSettings({ phoneNumber: "0901234567" }),
    (error: { code?: string }) => error.code === "REVISION_REQUIRED");
  let writes = 0;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.method, "PATCH");
    assert.equal(new Headers(init?.headers).get("If-Match-Revision"), "4");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "phone-operation");
    writes += 1;
    return jsonResponse(200, { phoneNumber: "0901234567", revision: 5 });
  };
  const saved = await settingsService.saveSettings({ phoneNumber: "0901234567", revision: 4 }, "phone-operation");
  assert.equal(saved.revision, 5);
  assert.equal(writes, 1);
  apiService.clearSession();
});
