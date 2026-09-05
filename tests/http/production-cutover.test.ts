import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import apiWorker from "../../workers/api/index.ts";
import { dispatchBrowserApi, envelopeFromVerifiedRequest, MAX_API_BODY_BYTES } from "../../server/http/browserApi.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { createOwnerRuntime } from "../../workers/mcp/ownerRuntime.ts";
import { rejectPublicMcpRequest } from "../../workers/mcp/publicMcp.ts";
import { LIVE_STATE_KEY, type LiveKvNamespace } from "../../workers/mcp/liveKvStore.ts";
import type { SnapshotStorage } from "../../workers/mcp/snapshotStore.ts";
import type { BrowserApiEnvelope } from "../../server/http/browserApi.ts";

class MemoryCoordinator implements SnapshotStorage {
  values = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class MemoryKv implements LiveKvNamespace {
  values = new Map<string, string>();

  seed(key: string, value: unknown): void {
    this.values.set(key, JSON.stringify(value));
  }

  json<T = unknown>(key: string): T | null {
    const value = this.values.get(key);
    return value === undefined ? null : JSON.parse(value) as T;
  }

  async get<T = unknown>(key: string, type?: "json"): Promise<T | string | null> {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) as T : value;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const forgeSessionToken = async (signingSecret: string, claims: Record<string, unknown> = {}) => {
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    issuedAt: Date.now(),
    expiresAt: Date.now() + (60 * 60 * 1000),
    nonce: "cutover-test",
    ...claims,
  })).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(signature).toString("base64url")}`;
};

const baseEnv = (overrides: Record<string, unknown> = {}) => ({
  ADMIN_SECRET: "root",
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "https://giaban.khosihuythao.com",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { throw new Error("legacy writer must not run"); } },
  ...overrides,
});

const openShop = async () => {
  const kv = new MemoryKv();
  const coordinator = new MemoryCoordinator();
  const mcpEnv = { KSHT_API_KEY: "mcp-key" };
  const runtime = await createOwnerRuntime(coordinator, kv, mcpEnv, { minimumWriteIntervalMs: 0 });
  const env = baseEnv({
    GIABAN: { handleBrowserApi: (envelope: BrowserApiEnvelope) => runtime.handleBrowserApi(envelope) },
    DB: kv,
  });
  return { kv, coordinator, runtime, env, mcpEnv };
};

const login = async (env: ReturnType<typeof baseEnv>) => {
  const response = await handleKshtApi(new Request("https://api.example/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "pw" }),
  }), env);
  const body = await response.json() as { token: string };
  assert.equal(response.status, 200);
  return body.token;
};

const api = (env: ReturnType<typeof baseEnv>, path: string, init: RequestInit = {}) =>
  handleKshtApi(new Request(`https://api.example${path}`, init), env);

const authed = (token: string, extra: HeadersInit = {}) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
  ...extra,
});

const mcpCall = (name: string, args: Record<string, unknown> = {}) => new Request("https://mcp.example/mcp", {
  method: "POST",
  headers: { "content-type": "application/json", KSHT_API_KEY: "mcp-key" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
});

test("production wrangler binds ksht-api to ksht-mcp GiabanHttp and keeps one GiabanShop owner", () => {
  const apiConfig = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  const mcpConfig = fs.readFileSync(path.join(root, "wrangler.mcp.jsonc"), "utf8");
  const apiSource = fs.readFileSync(path.join(root, "workers/api/index.ts"), "utf8");
  const mcpSource = fs.readFileSync(path.join(root, "workers/mcp/index.ts"), "utf8");
  assert.match(apiConfig, /"main": "workers\/api\/index.ts"/);
  assert.match(apiConfig, /"binding": "GIABAN"/);
  assert.match(apiConfig, /"service": "ksht-mcp"/);
  assert.match(apiConfig, /"entrypoint": "GiabanHttp"/);
  assert.equal(apiConfig.includes("durable_objects"), false);
  assert.equal(apiSource.includes("MemoryStore"), false);
  assert.match(mcpConfig, /"class_name": "GiabanShop"/);
  assert.match(mcpSource, /export class GiabanHttp extends WorkerEntrypoint/);
  assert.match(mcpSource, /idFromName\("owner"\)/);
});

test("verified session /api/v1 catalog order payment and report share the owner queue with MCP", async () => {
  const { runtime, env, kv } = await openShop();
  const token = await login(env);

  const categoryRes = await api(env, "/api/v1/categories", {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "cutover-cat" }),
    body: JSON.stringify({ label: "Cọ sơn", value: "PAINT_BRUSH" }),
  });
  assert.equal(categoryRes.status, 201);
  const category = await categoryRes.json() as { id: string };

  const productRes = await api(env, "/api/v1/products", {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "cutover-prd" }),
    body: JSON.stringify({
      name: "Cọ",
      categoryId: category.id,
      description: "demo",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1 inch", unit: "Cây", price: 1000, costPrice: 400 }],
    }),
  });
  assert.equal(productRes.status, 201);
  const product = await productRes.json() as { id: string; variants: Array<{ costPrice: number }> };
  assert.equal(product.variants[0].costPrice, 400);

  const listedAdmin = await api(env, "/api/v1/products?limit=1", { headers: authed(token) });
  const listedAdminBody = await listedAdmin.json() as { items: unknown[]; page: { hasMore: boolean; limit: number } };
  assert.equal(listedAdmin.status, 200);
  assert.equal(listedAdminBody.page.limit, 1);

  const publicRes = await api(env, "/api/v1/public/products");
  const publicBody = await publicRes.json() as { items: Array<{ variants: object[] }> };
  assert.equal(publicRes.status, 200);
  assert.equal("costPrice" in publicBody.items[0].variants[0], false);

  const customerRes = await api(env, "/api/v1/customers", {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "cutover-cus" }),
    body: JSON.stringify({ name: "Nguyen Van A", phone: "0901234567", address: "1 Le Loi" }),
  });
  const customer = await customerRes.json() as { id: string };
  const customers = await (await api(env, "/api/v1/customers?limit=100", { headers: authed(token) })).json() as {
    items: Array<{ phone?: string; phoneMasked?: string }>;
  };
  assert.equal("phone" in customers.items[0], false);
  assert.equal(typeof customers.items[0].phoneMasked, "string");

  const draftRes = await api(env, "/api/v1/orders", {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "cutover-ord" }),
    body: JSON.stringify({
      customerId: customer.id,
      contactSnapshot: { name: "Nguyen Van A", phone: "0901234567", address: "1 Le Loi" },
      items: [{ name: "Cọ", unit: "Cây", quantity: 2, unitPrice: 1000, costPrice: 400, isManual: true }],
      discount: 0,
      shippingFee: 0,
    }),
  });
  const draft = await draftRes.json() as { id: string; revision: number; total: number };
  const confirmedRes = await api(env, `/api/v1/orders/${draft.id}/confirm`, {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "cutover-confirm", "If-Match-Revision": String(draft.revision) }),
    body: "{}",
  });
  const confirmed = await confirmedRes.json() as { id: string; revision: number; total: number };
  assert.equal(confirmedRes.status, 201);

  const payRes = await api(env, `/api/v1/orders/${confirmed.id}/payments`, {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "cutover-pay" }),
    body: JSON.stringify({ amount: confirmed.total, method: "cash" }),
  });
  assert.equal(payRes.status, 201);

  const reportRes = await api(env, "/api/v1/reports/summary", { headers: authed(token) });
  assert.equal(reportRes.status, 200);

  const mcpListed = await runtime.handleMcp(mcpCall("giaban_list_products"));
  const mcpBody = await mcpListed.json() as { result: { structuredContent: { items: Array<{ id: string; variants: Array<{ costPrice: number }> } > } } };
  assert.equal(mcpBody.result.structuredContent.items.some((item) => item.id === product.id), true);
  assert.equal(mcpBody.result.structuredContent.items[0].variants[0].costPrice, 400);
  assert.equal(kv.values.has(LIVE_STATE_KEY), true);
});

test("invalid expired and forged credentials cannot become legacy admin", async () => {
  const { env } = await openShop();
  const missing = await api(env, "/api/v1/products");
  assert.equal(missing.status, 401);
  const missingBody = await missing.json() as { code: string };
  assert.equal(missingBody.code, "UNAUTHENTICATED");

  const invalid = await api(env, "/api/v1/products", { headers: { authorization: "Bearer not-a-session" } });
  assert.equal(invalid.status, 401);

  const expired = await forgeSessionToken("sign", { issuedAt: Date.now() - 2000, expiresAt: Date.now() - 1000 });
  const expiredRes = await api(env, "/api/v1/status", { headers: { authorization: `Bearer ${expired}` } });
  assert.equal(expiredRes.status, 401);

  const mcpAsSession = await api(env, "/api/v1/products", { headers: { authorization: "Bearer mcp-key" } });
  assert.equal(mcpAsSession.status, 401);

  const spoofed = await api(env, "/api/v1/products", {
    headers: { "X-Giaban-Actor": "legacyAdmin", "X-Internal-Actor": "owner" },
  });
  assert.equal(spoofed.status, 401);
});

test("public MCP ingress ignores browser actor headers and does not serve /api/v1", async () => {
  const mcpEnv = { KSHT_API_KEY: "mcp-key" };
  const spoofed = await rejectPublicMcpRequest(new Request("https://mcp.example/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Giaban-Actor": "legacyAdmin" },
    body: "{}",
  }), mcpEnv);
  assert.equal(spoofed?.status, 401);

  const v1 = await rejectPublicMcpRequest(new Request("https://mcp.example/api/v1/products", {
    method: "GET",
    headers: { authorization: "Bearer mcp-key", "X-Giaban-Actor": "legacyAdmin" },
  }), mcpEnv);
  assert.equal(v1?.status, 404);
});

test("internal envelope never trusts owner actor or identity headers", async () => {
  const { runtime } = await openShop();
  const owner = await dispatchBrowserApi(runtime.app, {
    method: "GET",
    url: "https://api.example/api/v1/products",
    headerPairs: [["authorization", "Bearer mcp-key"]],
    body: null,
    actor: "owner",
    requestId: "req_spoof",
  });
  assert.equal(owner.status, 403);

  const request = new Request("https://api.example/api/v1/products", {
    headers: { authorization: "Bearer secret", "X-Giaban-Actor": "owner", "Idempotency-Key": "keep" },
  });
  const envelope = envelopeFromVerifiedRequest(request, "public", null, "req_strip");
  assert.equal(envelope.headerPairs.some(([key]) => key.toLowerCase() === "authorization"), false);
  assert.equal(envelope.headerPairs.some(([key]) => key.toLowerCase() === "x-giaban-actor"), false);
  assert.equal(envelope.actor, "public");
});

test("browser sessions cannot restore reconcile or merge", async () => {
  const { env } = await openShop();
  const token = await login(env);
  const restore = await api(env, "/api/v1/restores/confirm", {
    method: "POST",
    headers: authed(token),
    body: JSON.stringify({ confirmationToken: "cnf_not_enough_priv" }),
  });
  assert.equal(restore.status, 403);
  const reconcile = await api(env, "/api/v1/migrations/live-reconciliation/preview", {
    method: "POST",
    headers: authed(token),
    body: "{}",
  });
  assert.equal(reconcile.status, 403);
  const merge = await api(env, "/api/v1/customers/merge/preview", {
    method: "POST",
    headers: authed(token),
    body: JSON.stringify({ canonicalCustomerId: "a", sourceCustomerId: "b" }),
  });
  assert.equal(merge.status, 403);
});

test("write fence and restart keep one committed shop for HTTP and MCP", async () => {
  const { kv, coordinator, env, mcpEnv } = await openShop();
  const token = await login(env);
  const categoryRes = await api(env, "/api/v1/categories", {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "fence-cat" }),
    body: JSON.stringify({ label: "Cọ", value: "PAINT" }),
  });
  assert.equal(categoryRes.status, 201);

  const reopened = await createOwnerRuntime(coordinator, kv, mcpEnv, { minimumWriteIntervalMs: 0 });
  const mcpListed = await reopened.handleMcp(mcpCall("giaban_list_categories"));
  const mcpBody = await mcpListed.json() as { result: { structuredContent: { items: Array<{ value: string }> } } };
  assert.equal(mcpBody.result.structuredContent.items.some((item) => item.value === "PAINT"), true);

  const products = kv.json<unknown[]>("products") ?? [];
  kv.seed("products", [...(Array.isArray(products) ? products : []), { id: "p_external", name: "web-admin", category: "PAINT" }]);
  const drifted = await createOwnerRuntime(coordinator, kv, mcpEnv, { minimumWriteIntervalMs: 0 });
  const driftedEnv = baseEnv({
    GIABAN: { handleBrowserApi: (envelope: BrowserApiEnvelope) => drifted.handleBrowserApi(envelope) },
    DB: kv,
  });
  const blocked = await api(driftedEnv, "/api/v1/categories", {
    method: "POST",
    headers: authed(token, { "Idempotency-Key": "blocked-after-drift" }),
    body: JSON.stringify({ label: "Chặn", value: "BLOCKED" }),
  });
  assert.equal(blocked.status, 423);
  const blockedBody = await blocked.json() as { code: string };
  assert.equal(blockedBody.code, "MIGRATION_READ_ONLY");
});

test("legacy whole-key POST is fenced and missing coordinator fail-closes", async () => {
  const writes: unknown[] = [];
  const env = baseEnv({
    DB: {
      async get() { return JSON.stringify([]); },
      async put(key: string, value: string) { writes.push([key, value]); },
    },
  });
  const token = await login(env);
  const written = await api(env, "/api/data/orders", {
    method: "POST",
    headers: authed(token),
    body: JSON.stringify([{ id: "o1" }]),
  });
  assert.equal(written.status, 423);
  assert.deepEqual(writes, []);

  const missing = await apiWorker.fetch(new Request("https://api.example/api/v1/status", {
    headers: authed(token),
  }), env);
  assert.equal(missing.status, 503);
});

test("body limits invalid JSON CORS and localhost origin fail closed", async () => {
  const { env } = await openShop();
  const token = await login(env);
  const tooLarge = await api(env, "/api/v1/products", {
    method: "POST",
    headers: authed(token, { "content-length": String(MAX_API_BODY_BYTES + 1) }),
    body: "{}",
  });
  assert.equal(tooLarge.status, 413);

  const invalidJson = await api(env, "/api/v1/products", {
    method: "POST",
    headers: authed(token),
    body: "{",
  });
  assert.equal(invalidJson.status, 400);

  const preflight = await api(env, "/api/v1/products", {
    method: "OPTIONS",
    headers: {
      Origin: "https://giaban.khosihuythao.com",
      "Access-Control-Request-Method": "PATCH",
    },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("Access-Control-Allow-Methods") ?? "", /PATCH/);

  const localhost = await api(env, "/api/v1/public/products", {
    headers: { Origin: "http://localhost:3000" },
  });
  assert.equal(localhost.status, 403);
});

test("v1 bounds streamed UTF-8 bytes without Content-Length before calling the provider", async () => {
  let forwarded = 0;
  const env = baseEnv({ GIABAN: { async handleBrowserApi() { forwarded += 1; throw new Error("must not forward"); } } });
  const token = await login(env);
  let cancelled = false;
  let chunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunks++ >= 5) controller.close();
      else controller.enqueue(new TextEncoder().encode("ộ".repeat(32_768)));
    },
    cancel() { cancelled = true; },
  });
  const response = await api(env, "/api/v1/products", {
    method: "POST", headers: authed(token), body,
    duplex: "half",
  } as RequestInit);
  assert.equal(response.status, 413);
  assert.equal(forwarded, 0);
  assert.equal(cancelled, true);
});
