import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, legacyAdminContext, publicContext } from "../../server/application/giaban.ts";
import { handleApiV1 } from "../../server/http/adapter.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const request = (path: string, init?: RequestInit) => new Request(`https://giaban.example${path}`, init);

const jsonWrite = (path: string, body: unknown, extra: Record<string, string> = {}) =>
  request(path, {
    method: extra.method || "POST",
    headers: {
      authorization: "Bearer session",
      "content-type": "application/json",
      "Idempotency-Key": extra.idempotencyKey || crypto.randomUUID(),
      ...(extra.revision ? { "If-Match-Revision": extra.revision } : {}),
    },
    body: JSON.stringify(body),
  });

test("legacy admin session can complete Phase 6 catalog-order-payment flow over /api/v1", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const admin = legacyAdminContext();

  const categoryRes = await handleApiV1(jsonWrite("/api/v1/categories", { label: "Cọ sơn", value: "PAINT_BRUSH" }), app, admin);
  assert.equal(categoryRes?.status, 201);
  const category = await categoryRes!.json() as { id: string };

  const productRes = await handleApiV1(jsonWrite("/api/v1/products", {
    name: "Cọ",
    categoryId: category.id,
    description: "demo",
    image: "https://example.invalid/p.png",
    variants: [{ size: "1 inch", unit: "Cây", price: 1000, costPrice: 400 }],
  }), app, admin);
  assert.equal(productRes?.status, 201);

  const customerRes = await handleApiV1(jsonWrite("/api/v1/customers", {
    name: "Nguyen Van A",
    phone: "0901234567",
    address: "1 Le Loi",
  }), app, admin);
  assert.equal(customerRes?.status, 201);
  const customer = await customerRes!.json() as { id: string };

  const draftRes = await handleApiV1(jsonWrite("/api/v1/orders", {
    customerId: customer.id,
    contactSnapshot: { name: "Nguyen Van A", phone: "0901234567", address: "1 Le Loi" },
    items: [{ name: "Cọ", unit: "Cây", quantity: 2, unitPrice: 1000, costPrice: 400, isManual: true }],
    discount: 0,
    shippingFee: 0,
  }), app, admin);
  assert.equal(draftRes?.status, 201);
  const draft = await draftRes!.json() as { id: string; revision: number; total: number };

  const confirmRes = await handleApiV1(jsonWrite(`/api/v1/orders/${draft.id}/confirm`, {}, { revision: String(draft.revision) }), app, admin);
  assert.equal(confirmRes?.status, 201);
  const confirmed = await confirmRes!.json() as { id: string; revision: number; total: number };

  const invoiceRes = await handleApiV1(request(`/api/v1/orders/${confirmed.id}/invoice`, {
    headers: { authorization: "Bearer session" },
  }), app, admin);
  assert.equal(invoiceRes?.status, 200);
  const invoice = await invoiceRes!.json() as { contact: { phone: string }; items: unknown[] };
  assert.equal(invoice.contact.phone, "0901234567");
  assert.equal(invoice.items.length, 1);

  const payRes = await handleApiV1(jsonWrite(`/api/v1/orders/${confirmed.id}/payments`, {
    amount: confirmed.total,
    method: "cash",
  }), app, admin);
  assert.equal(payRes?.status, 201);

  const publicRes = await handleApiV1(request("/api/v1/public/products"), app, publicContext());
  assert.equal(publicRes?.status, 200);
  const published = await publicRes!.json() as { items: Array<{ variants: object[] }> };
  assert.equal("costPrice" in published.items[0].variants[0], false);

  const mergeRes = await handleApiV1(jsonWrite("/api/v1/customers/merge/preview", {
    canonicalCustomerId: customer.id,
    sourceCustomerId: customer.id,
  }), app, admin);
  assert.equal(mergeRes?.status, 403);
});
