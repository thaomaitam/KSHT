import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { handleMcpRequest } from "../../workers/mcp/server.ts";

const rpc = (method: string, params?: unknown, id: number | null = 1) =>
  new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

test("GitHub OAuth discovery is not exposed by the personal MCP", async () => {
  const response = await handleMcpRequest(
    new Request("https://mcp.example/.well-known/oauth-protected-resource"),
    new GiabanApplication(new MemoryStore()),
    null,
  );
  assert.equal(response.status, 404);
});

test("MCP requests without a bearer context are JSON-RPC 401", async () => {
  const response = await handleMcpRequest(rpc("initialize"), new GiabanApplication(new MemoryStore()), null);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), "Bearer realm=\"mcp\"");
  const body = await response.json();
  assert.equal(body.jsonrpc, "2.0");
  assert.equal(body.error.message, "invalid_token");
});

test("initialize echoes a supported client protocol version", async () => {
  const response = await handleMcpRequest(
    rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "pi", version: "1" } }),
    new GiabanApplication(new MemoryStore()),
    ownerContext(),
  );
  const body = await response.json();
  assert.equal(body.result.protocolVersion, "2025-06-18");
});

test("server/discover advertises 2026-07-28", async () => {
  const response = await handleMcpRequest(rpc("server/discover", {}), new GiabanApplication(new MemoryStore()), ownerContext());
  const body = await response.json();
  assert.equal(body.result.supportedVersions.includes("2026-07-28"), true);
  assert.equal(body.result.capabilities.tools.listChanged, false);
});

test("tools/list and tools/call use the contract registry", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const listed = await handleMcpRequest(rpc("tools/list"), app, ownerContext());
  const listBody = await listed.json();
  assert.equal(listBody.result.resultType, "complete");
  assert.equal(listBody.result.ttlMs, 0);
  assert.equal(listBody.result.cacheScope, "private");
  assert.equal(listBody.result.tools.some((tool: { name: string }) => tool.name === "giaban_get_status"), true);
  const called = await handleMcpRequest(
    rpc("tools/call", { name: "giaban_get_status", arguments: {} }),
    app,
    ownerContext(),
  );
  const callBody = await called.json();
  assert.equal(callBody.result.resultType, "complete");
  assert.equal(callBody.result.structuredContent.ok, true);
});

test("local test bearer is accepted only with TEST_OWNER_ID", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const authed = () => new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer giaban-local-test" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const allowed = await handleMcpRequest(authed(), app, null, {
    TEST_OWNER_ID: "owner-local",
    LOCAL_MCP_BEARER: "giaban-local-test",
  });
  assert.equal(allowed.status, 200);
  const denied = await handleMcpRequest(authed(), app, null, { LOCAL_MCP_BEARER: "giaban-local-test" });
  assert.equal(denied.status, 401);
});

test("unknown tool names have no raw fallback", async () => {
  const response = await handleMcpRequest(
    rpc("tools/call", { name: "giaban_raw_sql", arguments: {} }),
    new GiabanApplication(new MemoryStore()),
    ownerContext(),
  );
  const body = await response.json();
  assert.equal(body.error.code, -32601);
});

test("KSHT_API_KEY header authenticates without OAuth", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const authed = () => new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", KSHT_API_KEY: "personal-key" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
  const allowed = await handleMcpRequest(authed(), app, null, { KSHT_API_KEY: "personal-key" });
  assert.equal(allowed.status, 200);
  const denied = await handleMcpRequest(authed(), app, null, { KSHT_API_KEY: "other-key" });
  assert.equal(denied.status, 401);
  const ignoredAdminPass = await handleMcpRequest(authed(), app, null, { MK_ADMIN: "personal-key" } as never);
  assert.equal(ignoredAdminPass.status, 401);
});

test("API-key MCP forwards idempotency and revision controls into the application", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const call = () => new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", KSHT_API_KEY: "personal-key" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "giaban_create_customer",
        arguments: { name: "A", phone: "0901", address: "x", idempotencyKey: "same-customer" },
      },
    }),
  });
  const first = await handleMcpRequest(call(), app, null, { KSHT_API_KEY: "personal-key" });
  const second = await handleMcpRequest(call(), app, null, { KSHT_API_KEY: "personal-key" });
  const firstBody = await first.json();
  const secondBody = await second.json();
  const customers = await app.query({ operationId: "listCustomers", input: {} }, ownerContext()) as { items: unknown[] };
  assert.equal(firstBody.result.structuredContent.id, secondBody.result.structuredContent.id);
  assert.equal(customers.items.length, 1);
});

test("unfinished backup and restore tools are unavailable on personal MCP", async () => {
  const response = await handleMcpRequest(
    rpc("tools/call", { name: "giaban_confirm_restore", arguments: { confirmationToken: "unsafe" } }),
    new GiabanApplication(new MemoryStore()),
    ownerContext(),
  );
  const body = await response.json();
  assert.equal(body.error.code, -32601);
});

test("write kill switch blocks mutations", async () => {
  const response = await handleMcpRequest(
    rpc("tools/call", { name: "giaban_create_customer", arguments: { name: "A", phone: "0901", address: "x" } }),
    new GiabanApplication(new MemoryStore()),
    ownerContext(),
    { MCP_WRITE_DISABLED: "1" },
  );
  const body = await response.json();
  assert.equal(body.error.message, "MCP writes disabled");
});

test("status and capabilities expose the active write kill switch", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const env = { MCP_WRITE_DISABLED: "1" };
  const statusResponse = await handleMcpRequest(
    rpc("tools/call", { name: "giaban_get_status", arguments: {} }),
    app,
    ownerContext(),
    env,
  );
  const capabilitiesResponse = await handleMcpRequest(
    rpc("tools/call", { name: "giaban_get_capabilities", arguments: {} }),
    app,
    ownerContext(),
    env,
  );
  const status = await statusResponse.json();
  const capabilities = await capabilitiesResponse.json();

  assert.equal(status.result.structuredContent.mcpMutationsEnabled, false);
  assert.equal(capabilities.result.structuredContent.killSwitches.mcpWrite, true);
});
