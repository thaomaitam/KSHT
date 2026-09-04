import { createServer, type IncomingMessage } from "node:http";

import { GiabanApplication } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { handleMcpRequest, type McpEnv } from "./server.ts";

const host = "127.0.0.1";
const port = Number(process.env.GIABAN_MCP_PORT || "8788");
const origin = `http://${host}:${port}`;

const toHeaders = (req: IncomingMessage): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
};

const readBody = async (req: IncomingMessage): Promise<Buffer | undefined> => {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

const app = new GiabanApplication(new MemoryStore());
const env: McpEnv = {
  TEST_OWNER_ID: process.env.TEST_OWNER_ID || "owner-local",
  MCP_PUBLIC_URL: process.env.MCP_PUBLIC_URL || `${origin}/mcp`,
  MCP_WRITE_DISABLED: process.env.MCP_WRITE_DISABLED,
  MCP_RECONCILE_ENABLED: process.env.MCP_RECONCILE_ENABLED,
  MCP_READ_DISABLED: process.env.MCP_READ_DISABLED,
  MCP_CHANNEL_DISABLED: process.env.MCP_CHANNEL_DISABLED,
  LOCAL_MCP_BEARER: process.env.LOCAL_MCP_BEARER || "giaban-local-test",
  KSHT_API_KEY: process.env.KSHT_API_KEY,
};

const server = createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url || "/", origin);
      const body = await readBody(req);
      const request = new Request(url, {
        method: req.method,
        headers: toHeaders(req),
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
      });
      const response = await handleMcpRequest(request, app, null, env);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      res.writeHead(response.status, responseHeaders);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
    }
  })();
});

server.listen(port, host, () => {
  process.stdout.write(`Giaban local MCP ${origin}/mcp TEST_OWNER_ID=${env.TEST_OWNER_ID}\n`);
});
