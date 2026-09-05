import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("giabanClient listProducts requests limit=100 and does not follow nextCursor", async () => {
  const urls: string[] = [];
  globalThis.fetch = async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return jsonResponse(200, {
      items: [{ id: "prd_1", name: "A", categoryId: "cat", description: "", image: "", variants: [], revision: 1 }],
      page: { hasMore: true, nextCursor: "next-1", limit: 100 },
    });
  };

  const { giabanClient } = await import("../../client/giabanClient.ts");
  const page = await giabanClient.listProducts();
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/api\/v1\/products\?limit=100$/);
  assert.equal(page.page.hasMore, true);
  assert.equal(page.page.nextCursor, "next-1");
});

test("401 clears the session and surfaces CloudWriteError", async () => {
  const { apiService } = await import("../../apiService.ts");
  apiService.setSession("session-token-value", Date.now() + 60_000);
  globalThis.fetch = async () => jsonResponse(401, { code: "UNAUTHENTICATED", message: "Expired", retryable: false });
  const { giabanClient, CloudWriteError } = await import("../../client/giabanClient.ts");
  await assert.rejects(() => giabanClient.listProducts(), (error: unknown) => {
    assert.ok(error instanceof CloudWriteError);
    assert.equal(error.status, 401);
    return true;
  });
  assert.equal(apiService.getSessionToken(), "");
});

test("network failure is retryable and does not fake local success", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const { giabanClient, CloudWriteError } = await import("../../client/giabanClient.ts");
  await assert.rejects(() => giabanClient.getStatus(), (error: unknown) => {
    assert.ok(error instanceof CloudWriteError);
    assert.equal(error.retryable, true);
    assert.equal(error.code, "OFFLINE");
    return true;
  });
});

test("writes send Idempotency-Key and omit extra body fields", async () => {
  let init: RequestInit | undefined;
  globalThis.fetch = async (_input: RequestInfo | URL, requestInit?: RequestInit) => {
    init = requestInit;
    return jsonResponse(201, { id: "cus_1", revision: 1 });
  };
  const { giabanClient } = await import("../../client/giabanClient.ts");
  await giabanClient.createCustomer({ name: "Lan", phone: "0901", address: "Q1" }, "idem-123456");
  const headers = new Headers(init?.headers);
  assert.equal(headers.get("Idempotency-Key"), "idem-123456");
  assert.equal(init?.method, "POST");
});

test("getReportSummary requires fromDate and toDate query params", async () => {
  let url = "";
  globalThis.fetch = async (input: RequestInfo | URL) => {
    url = String(input);
    return jsonResponse(200, {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      timezone: "Asia/Ho_Chi_Minh",
      confirmedSales: 0,
      grossReceipts: 0,
      refunds: 0,
      netReceipts: 0,
      receivables: 0,
      discounts: 0,
      shippingFees: 0,
      cogs: 0,
      profit: 0,
    });
  };
  const { giabanClient } = await import("../../client/giabanClient.ts");
  await giabanClient.getReportSummary("2026-01-01", "2026-01-31");
  assert.match(url, /\/api\/v1\/reports\/summary\?fromDate=2026-01-01&toDate=2026-01-31$/);
});

test("cancel preview body is reason only", async () => {
  let body = "";
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    body = String(init?.body || "");
    return jsonResponse(200, { confirmationToken: "token-token-token", blockers: [] });
  };
  const { giabanClient } = await import("../../client/giabanClient.ts");
  await giabanClient.previewOrderCancellation("ord_1", "Khách hủy");
  assert.deepEqual(JSON.parse(body), { reason: "Khách hủy" });
});
