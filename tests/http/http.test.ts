import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { handleApiV1 } from "../../server/http/adapter.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { handleMcpRequest } from "../../workers/mcp/server.ts";

const request = (path: string, init?: RequestInit) => new Request(`https://giaban.example${path}`, init);

test("GET /api/v1/status returns dataset generation", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const response = await handleApiV1(request("/api/v1/status"), app, ownerContext());
  assert.equal(response?.status, 200);
  const body = await response!.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.datasetGenerationId, "string");
  assert.equal(body.migrationDiagnostics.sourceHash, "");
  assert.equal(body.migrationDiagnostics.customerLinks.explicitValidId, 0);
  assert.equal(body.migrationDiagnostics.money.unexplainedTotalMismatch, 0);
});

test("unknown v1 route is 404 and non-v1 is ignored", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const missing = await handleApiV1(request("/api/v1/nope"), app, ownerContext());
  assert.equal(missing?.status, 404);
  const ignored = await handleApiV1(request("/api/data/products"), app, ownerContext());
  assert.equal(ignored, null);
});

test("public products omit costPrice over HTTP", async () => {
  const app = new GiabanApplication(new MemoryStore());
  await app.execute({
    operationId: "createCategory",
    input: { label: "Cọ", value: "PAINT" },
  }, ownerContext({ idempotencyKey: "c" }));
  const category = (await app.query({ operationId: "listCategories", input: {} }, ownerContext())).items[0];
  await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, ownerContext({ idempotencyKey: "p" }));
  const response = await handleApiV1(request("/api/v1/public/products"), app, ownerContext());
  const body = await response!.json();
  assert.equal("costPrice" in body.items[0].variants[0], false);
});

test("HTTP and MCP list products apply cursor after filters", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const generationId = app.store.state.generationId;
  const now = "2026-03-01T00:00:00.000Z";
  app.store.state.categories.set("cat_a", {
    id: "cat_a", label: "Cọ", value: "PAINT", archived: false, revision: 1, datasetGenerationId: generationId, createdAt: now, updatedAt: now,
  });
  for (let index = 0; index < 120; index += 1) {
    const id = `prd_${String(index).padStart(3, "0")}`;
    app.store.state.products.set(id, {
      id,
      name: index % 2 === 0 ? `Cọ ${index}` : `Lô ${index}`,
      categoryId: "cat_a",
      description: "d",
      image: "https://example.invalid/p.png",
      isHot: false,
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
      archived: false,
      revision: 1,
      datasetGenerationId: generationId,
      createdAt: `2026-03-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      updatedAt: now,
    });
  }

  const first = await handleApiV1(request(`/api/v1/products?limit=40&q=${encodeURIComponent("Cọ")}`), app, ownerContext());
  assert.equal(first?.status, 200);
  const firstBody = await first!.json();
  assert.equal(firstBody.items.length, 40);
  assert.equal(firstBody.page.hasMore, true);
  assert.equal(typeof firstBody.page.nextCursor, "string");

  const second = await handleApiV1(
    request(`/api/v1/products?limit=40&q=${encodeURIComponent("Cọ")}&cursor=${encodeURIComponent(firstBody.page.nextCursor)}`),
    app,
    ownerContext(),
  );
  const secondBody = await second!.json();
  assert.equal(secondBody.items.some((row: { id: string }) => firstBody.items.some((item: { id: string }) => item.id === row.id)), false);

  const bad = await handleApiV1(request("/api/v1/products?cursor=not-a-cursor"), app, ownerContext());
  assert.equal(bad?.status, 400);
  const badBody = await bad!.json();
  assert.equal(badBody.code, "VALIDATION_ERROR");

  const empty = await handleApiV1(request("/api/v1/products?limit=10&q=khong-co"), app, ownerContext());
  const emptyBody = await empty!.json();
  assert.deepEqual(emptyBody.items, []);
  assert.equal(emptyBody.page.hasMore, false);
  assert.equal(emptyBody.page.nextCursor, null);

  const mcp = async (cursor?: string) => {
    const response = await handleMcpRequest(
      new Request("https://mcp.example/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "giaban_list_products", arguments: { limit: 40, q: "Cọ", cursor } },
        }),
      }),
      app,
      ownerContext(),
    );
    const body = await response.json() as { result: { structuredContent: { items: Array<{ id: string }>; page: { nextCursor: string | null; hasMore: boolean } } } };
    return body.result.structuredContent;
  };
  const mcpFirst = await mcp();
  assert.equal(mcpFirst.items.length, 40);
  const mcpSecond = await mcp(mcpFirst.page.nextCursor ?? undefined);
  assert.equal(mcpSecond.items.some((row) => mcpFirst.items.some((item) => item.id === row.id)), false);
});
