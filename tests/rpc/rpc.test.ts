import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { GiabanDomain } from "../../server/rpc/domain.ts";
import { issueAssertion } from "../../server/safety/assertion.ts";
import { handleMcpRequest } from "../../workers/mcp/server.ts";

const SECRET = "assertion-secret-for-tests";

test("GiabanDomain invoke verifies assertion and returns status", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const domain = new GiabanDomain(app, SECRET);
  const assertion = await issueAssertion(SECRET, ownerContext());
  const result = await domain.invoke({ operationId: "getStatus", assertion }) as { ok: boolean };
  assert.equal(result.ok, true);
});

test("MCP tools/call can use DOMAIN service binding", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const domain = new GiabanDomain(app, SECRET);
  const response = await handleMcpRequest(
    new Request("https://mcp.example/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "giaban_get_status", arguments: {} } }),
    }),
    null,
    ownerContext(),
    { DOMAIN: domain, ASSERTION_SECRET: SECRET },
  );
  const body = await response.json();
  assert.equal(body.result.structuredContent.ok, true);
});
