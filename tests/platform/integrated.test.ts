import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { handleApiV1 } from "../../server/http/adapter.ts";
import { SqliteStore } from "../../server/persistence/d1/sqliteStore.ts";
import { handleMcpRequest } from "../../workers/mcp/server.ts";

test("sqlite-backed HTTP and MCP share catalog and hide cost on public projection", async () => {
  const app = new GiabanApplication(new SqliteStore());
  const context = ownerContext();
  const category = await app.execute({
    operationId: "createCategory",
    input: { label: "Cọ", value: "PAINT" },
  }, { ...context, idempotencyKey: "int-cat" }) as { id: string };
  await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, { ...context, idempotencyKey: "int-prd" });

  const http = await handleApiV1(new Request("https://api.example/api/v1/public/products"), app, context);
  const publicBody = await http!.json() as { items: Array<{ variants: object[] }> };
  assert.equal("costPrice" in publicBody.items[0].variants[0], false);

  const mcp = await handleMcpRequest(
    new Request("https://mcp.example/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "giaban_list_products", arguments: {} } }),
    }),
    app,
    context,
  );
  const mcpBody = await mcp.json();
  assert.equal(mcpBody.result.structuredContent.items[0].variants[0].costPrice, 400);
});
