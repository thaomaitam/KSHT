import { MAX_API_BODY_BYTES } from "../../server/http/limits.ts";
import { hasValidPersonalApiKey, type McpEnv } from "./server.ts";

export const rejectPublicMcpRequest = async (request: Request, env: McpEnv): Promise<Response | null> => {
  const url = new URL(request.url);
  if (env.MCP_CHANNEL_DISABLED === "1") return Response.json({ error: "MCP channel disabled" }, { status: 503 });
  if (url.pathname !== "/mcp") return Response.json({ error: "Not Found" }, { status: 404 });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    return Response.json({ error: "request_too_large" }, { status: 413 });
  }
  if (!await hasValidPersonalApiKey(request, env)) {
    return Response.json({ error: "invalid_token" }, {
      status: 401,
      headers: { "www-authenticate": "Bearer realm=\"mcp\"" },
    });
  }
  return null;
};
