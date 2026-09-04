import { DomainError } from "../../server/domain/errors.ts";
import { GiabanApplication } from "../../server/application/giaban.ts";
import { ALL_SCOPES, OPERATIONS, operationByTool } from "../../server/application/registry.ts";
import { issueAssertion, type InvocationContext } from "../../server/safety/assertion.ts";
import type { InvokeEnvelope } from "../../server/rpc/invoke.ts";

const PROTOCOL = "2026-07-28";
const SUPPORTED_PROTOCOL_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18"] as const;

export const PERSONAL_MCP_DISABLED_OPERATION_IDS = new Set([
  "previewBackupExport",
  "confirmBackupExport",
  "getBackupManifest",
  "createBackupDownloadGrant",
  "createBackupUploadIntent",
  "finalizeBackupUpload",
  "previewRestore",
  "confirmRestore",
]);

const negotiateProtocol = (requested: unknown): string =>
  typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : PROTOCOL;

export interface McpEnv {
  MCP_PUBLIC_URL?: string;
  MCP_READ_DISABLED?: string;
  MCP_WRITE_DISABLED?: string;
  MCP_RECONCILE_ENABLED?: string;
  MCP_CHANNEL_DISABLED?: string;
  TEST_OWNER_ID?: string;
  ASSERTION_SECRET?: string;
  LOCAL_MCP_BEARER?: string;
  KSHT_API_KEY?: string;
  DOMAIN?: { invoke(envelope: InvokeEnvelope): Promise<unknown> };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const rpcError = (id: unknown, code: number, message: string, data?: unknown) =>
  json({ jsonrpc: "2.0", id, error: { code, message, data } });

const rpcResult = (id: unknown, result: Record<string, unknown>) =>
  json({
    jsonrpc: "2.0",
    id,
    result: { ttlMs: 0, cacheScope: "private", ...result, resultType: "complete" },
  });

const ownerMcpContext = (githubUserId: string, clientId: string): InvocationContext => ({
  principalId: "principal_owner",
  githubUserId,
  scopes: [...ALL_SCOPES],
  channel: "mcp",
  requestId: crypto.randomUUID(),
  now: new Date(),
  clientId,
});

const presentedApiKey = (request: Request): string => {
  const headerKey = request.headers.get("KSHT_API_KEY")?.trim() || "";
  if (headerKey) return headerKey;
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
};

const secretValuesEqual = async (left: string, right: string): Promise<boolean> => {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
};

export const hasValidPersonalApiKey = async (request: Request, env: McpEnv): Promise<boolean> => {
  const expected = env.KSHT_API_KEY?.trim() || "";
  const presented = presentedApiKey(request);
  return secretValuesEqual(presented, expected);
};

const personalApiKeyContext = async (request: Request, env: McpEnv): Promise<InvocationContext | null> => {
  if (!await hasValidPersonalApiKey(request, env)) return null;
  return ownerMcpContext("owner", "mcp-api-key");
};

const localTestContext = async (request: Request, env: McpEnv): Promise<InvocationContext | null> => {
  if (!env.TEST_OWNER_ID || !env.LOCAL_MCP_BEARER) return null;
  const presented = presentedApiKey(request);
  if (!await secretValuesEqual(presented, env.LOCAL_MCP_BEARER)) return null;
  return ownerMcpContext(env.TEST_OWNER_ID, "mcp-local");
};

const tools = OPERATIONS.filter((operation) => operation.tool && !PERSONAL_MCP_DISABLED_OPERATION_IDS.has(operation.operationId)).map((operation) => ({
  name: operation.tool,
  description: `Giaban ${operation.operationId}`,
  annotations: {
    readOnlyHint: operation.kind === "query",
    destructiveHint: operation.kind === "confirm" || operation.operationId.includes("archive") || operation.operationId.includes("cancel"),
    idempotentHint: Boolean(operation.retryable) === false && operation.kind === "query",
    openWorldHint: false,
  },
  inputSchema: { type: "object", additionalProperties: true },
}));

export const handleMcpRequest = async (
  request: Request,
  app: GiabanApplication | null,
  context: InvocationContext | null,
  env: McpEnv = {},
): Promise<Response> => {
  const url = new URL(request.url);
  if (env.MCP_CHANNEL_DISABLED === "1") {
    return json({ error: "MCP channel disabled" }, 503);
  }
  if (url.pathname !== "/mcp") return json({ error: "Not Found" }, 404);
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let message: { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> };
  try {
    message = await request.json() as { jsonrpc: string; id?: unknown; method: string; params?: Record<string, unknown> };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  context = context
    ?? await personalApiKeyContext(request, env)
    ?? await localTestContext(request, env);
  if (!context) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code: -32000, message: "invalid_token" },
    }), {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": "Bearer realm=\"mcp\"",
      },
    });
  }
  if (message.method === "initialize") {
    return rpcResult(message.id, {
      protocolVersion: negotiateProtocol(message.params?.protocolVersion),
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "giaban-mcp", version: "1.0.0" },
    });
  }
  if (message.method === "server/discover") {
    return rpcResult(message.id, {
      supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      capabilities: { tools: { listChanged: false } },
      _meta: {
        "io.modelcontextprotocol/serverInfo": { name: "giaban-mcp", version: "1.0.0" },
      },
    });
  }
  if (message.method === "ping") return rpcResult(message.id, {});
  if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (message.method === "tools/list") {
    if (env.MCP_READ_DISABLED === "1") return rpcError(message.id, -32000, "MCP reads disabled");
    return rpcResult(message.id, { tools });
  }
  if (message.method === "tools/call") {
    const name = String(message.params?.name ?? "");
    const policy = operationByTool.get(name);
    if (!policy || PERSONAL_MCP_DISABLED_OPERATION_IDS.has(policy.operationId)) return rpcError(message.id, -32601, `Unknown tool ${name}`);
    const isWrite = policy.kind !== "query";
    const isLiveReconciliation = policy.operationId === "previewLiveReconciliation" || policy.operationId === "confirmLiveReconciliation";
    if (policy.operationId === "confirmLiveReconciliation" && env.MCP_RECONCILE_ENABLED !== "1") {
      return rpcError(message.id, -32000, "MCP live reconciliation disabled");
    }
    if (isWrite && env.MCP_WRITE_DISABLED === "1" && !isLiveReconciliation) return rpcError(message.id, -32000, "MCP writes disabled");
    const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
    const invocationContext: InvocationContext = {
      ...context,
      idempotencyKey: typeof args.idempotencyKey === "string" ? args.idempotencyKey : undefined,
      confirmationToken: typeof args.confirmationToken === "string" ? args.confirmationToken : undefined,
      expectedRevision: typeof args.expectedRevision === "number" ? args.expectedRevision : undefined,
    };
    try {
      let result: unknown;
      if (app) {
        result = await app.invoke(policy.kind, policy.operationId, args, invocationContext);
      } else if (env.DOMAIN && env.ASSERTION_SECRET) {
        const assertion = await issueAssertion(env.ASSERTION_SECRET, {
          principalId: invocationContext.principalId,
          githubUserId: invocationContext.githubUserId,
          scopes: invocationContext.scopes,
          channel: "mcp",
          clientId: invocationContext.clientId,
        });
        result = await env.DOMAIN.invoke({
          operationId: policy.operationId,
          input: args,
          assertion,
          requestId: invocationContext.requestId,
          idempotencyKey: invocationContext.idempotencyKey,
          confirmationToken: invocationContext.confirmationToken,
          expectedRevision: invocationContext.expectedRevision,
        });
      } else {
        return rpcError(message.id, -32000, "Domain binding unavailable");
      }
      if (policy.operationId === "getStatus" && result && typeof result === "object" && !Array.isArray(result)) {
        result = {
          ...(result as Record<string, unknown>),
          mcpMutationsEnabled: env.MCP_WRITE_DISABLED !== "1",
        };
      }
      if (policy.operationId === "getCapabilities" && result && typeof result === "object" && !Array.isArray(result)) {
        result = {
          ...(result as Record<string, unknown>),
          operations: OPERATIONS
            .filter((operation) => !PERSONAL_MCP_DISABLED_OPERATION_IDS.has(operation.operationId))
            .map((operation) => operation.operationId),
          mcpTools: tools.map((tool) => tool.name),
          killSwitches: {
            mcpRead: env.MCP_READ_DISABLED === "1",
            mcpWrite: env.MCP_WRITE_DISABLED === "1",
            mcpChannel: env.MCP_CHANNEL_DISABLED === "1",
            mcpReconcile: env.MCP_RECONCILE_ENABLED !== "1",
          },
        };
      }
      return rpcResult(message.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      });
    } catch (error) {
      const data = error instanceof DomainError ? error.toJSON() : { code: "INTERNAL_ERROR", message: "Internal error", retryable: true };
      return rpcResult(message.id, {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
      });
    }
  }
  return rpcError(message.id, -32601, `Unknown method ${message.method}`);
};
