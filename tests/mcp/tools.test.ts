import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { OPERATIONS } from "../../server/application/registry.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { handleMcpRequest, PERSONAL_MCP_DISABLED_OPERATION_IDS } from "../../workers/mcp/server.ts";

const rpc = (method: string, params?: unknown) =>
  new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

test("tools/list exposes approved registry tools and omits unfinished backup/restore", async () => {
  const listed = await handleMcpRequest(rpc("tools/list"), new GiabanApplication(new MemoryStore()), ownerContext());
  const body = await listed.json() as { result: { tools: Array<{ name: string }> } };
  const expected = OPERATIONS
    .filter((operation) => !PERSONAL_MCP_DISABLED_OPERATION_IDS.has(operation.operationId))
    .map((operation) => operation.tool)
    .filter((tool): tool is string => Boolean(tool))
    .sort();
  assert.deepEqual(body.result.tools.map((tool) => tool.name).sort(), expected);
  assert.equal(body.result.tools.some((tool) => tool.name === "giaban_confirm_restore"), false);
  assert.equal(body.result.tools.some((tool) => tool.name.includes("backup")), false);
});

test("MCP catalog, customer, order, payment, and report tools share one application", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const call = async (name: string, args: Record<string, unknown>, key?: string) => {
    const response = await handleMcpRequest(
      rpc("tools/call", { name, arguments: { ...args, idempotencyKey: key } }),
      app,
      ownerContext({ idempotencyKey: key }),
    );
    return (await response.json()).result.structuredContent;
  };
  const category = await call("giaban_create_category", { label: "Cọ", value: "PAINT" }, "t-cat");
  const product = await call("giaban_create_product", {
    name: "Cọ",
    categoryId: category.id,
    description: "d",
    image: "https://example.invalid/p.png",
    variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
  }, "t-prd");
  const customer = await call("giaban_create_customer", { name: "A", phone: "0901234567", address: "1" }, "t-cus");
  const order = await call("giaban_create_draft_order", {
    customerId: customer.id,
    items: [{ productId: product.id, name: "Cọ", unit: "Cây", quantity: 1, soCuon: 1, soKi: 0, unitPrice: 1000, costPrice: 400, isManual: false }],
  }, "t-ord");
  await call("giaban_confirm_order", { id: order.id }, "t-cfm");
  await call("giaban_record_payment", { orderId: order.id, amount: 1000, method: "cash" }, "t-pay");
  const report = await call("giaban_get_report_summary", {});
  assert.equal(report.confirmedSales, 1000);
  assert.equal(report.netReceipts, 1000);
  assert.equal(report.profit, 600);
});
