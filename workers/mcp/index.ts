import { DurableObject } from "cloudflare:workers";

import { GiabanApplication } from "../../server/application/giaban.ts";
import { handleMcpRequest, hasValidPersonalApiKey, type McpEnv } from "./server.ts";
import { LiveKvStore, type LiveKvNamespace } from "./liveKvStore.ts";

export interface McpWorkerEnv extends McpEnv {
  GIABAN_SHOP: DurableObjectNamespace<GiabanShop>;
  DB: LiveKvNamespace;
}

export class GiabanShop extends DurableObject<McpWorkerEnv> {
  app: GiabanApplication | null;
  store: LiveKvStore | null;
  requestTail: Promise<void>;

  constructor(ctx: DurableObjectState, env: McpWorkerEnv) {
    super(ctx, env);
    this.app = null;
    this.store = null;
    this.requestTail = Promise.resolve();
    this.ctx.blockConcurrencyWhile(() => this.hydrate());
  }

  async hydrate(): Promise<void> {
    const store = await LiveKvStore.open(this.ctx.storage, this.env.DB);
    this.store = store;
    this.app = new GiabanApplication(store);
  }

  async fetch(request: Request): Promise<Response> {
    const previous = this.requestTail;
    let release = () => {};
    this.requestTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      if (!this.app || !this.store) return Response.json({ error: "uninitialized" }, { status: 503 });
      await this.store.flushPending();
      await this.store.refreshConsistency();
      return await handleMcpRequest(request, this.app, null, this.env);
    } finally {
      release();
    }
  }
}

export default {
  async fetch(request: Request, env: McpWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (env.MCP_CHANNEL_DISABLED === "1") return Response.json({ error: "MCP channel disabled" }, { status: 503 });
    if (url.pathname !== "/mcp") return Response.json({ error: "Not Found" }, { status: 404 });
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 262_144) {
      return Response.json({ error: "request_too_large" }, { status: 413 });
    }
    if (!await hasValidPersonalApiKey(request, env)) {
      return Response.json({ error: "invalid_token" }, {
        status: 401,
        headers: { "www-authenticate": "Bearer realm=\"mcp\"" },
      });
    }
    const stub = env.GIABAN_SHOP.get(env.GIABAN_SHOP.idFromName("owner"));
    return stub.fetch(request);
  },
};
