import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

import {
  isBrowserActor,
  type BrowserApiEnvelope,
  type BrowserApiResult,
} from "../../server/http/browserApi.ts";
import { createOwnerRuntime, type OwnerRuntime } from "./ownerRuntime.ts";
import { rejectPublicMcpRequest } from "./publicMcp.ts";
import type { McpEnv } from "./server.ts";
import type { LiveKvNamespace } from "./liveKvStore.ts";

export interface McpWorkerEnv extends McpEnv {
  GIABAN_SHOP: DurableObjectNamespace<GiabanShop>;
  DB: LiveKvNamespace;
}

const forbiddenActor = (): BrowserApiResult => ({
  status: 403,
  headerPairs: [
    ["content-type", "application/json"],
    ["cache-control", "no-store"],
    ["x-content-type-options", "nosniff"],
  ],
  body: JSON.stringify({ code: "FORBIDDEN", message: "Invalid internal actor", retryable: false }),
});

const uninitialized = (): BrowserApiResult => ({
  status: 503,
  headerPairs: [
    ["content-type", "application/json"],
    ["cache-control", "no-store"],
    ["x-content-type-options", "nosniff"],
  ],
  body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Giaban coordinator unavailable", retryable: true }),
});

export class GiabanShop extends DurableObject<McpWorkerEnv> {
  runtime: OwnerRuntime | null;

  constructor(ctx: DurableObjectState, env: McpWorkerEnv) {
    super(ctx, env);
    this.runtime = null;
    this.ctx.blockConcurrencyWhile(() => this.hydrate());
  }

  async hydrate(): Promise<void> {
    this.runtime = await createOwnerRuntime(this.ctx.storage, this.env.DB, this.env);
  }

  async handleBrowserApi(envelope: BrowserApiEnvelope): Promise<BrowserApiResult> {
    if (!this.runtime) return uninitialized();
    return this.runtime.handleBrowserApi(envelope);
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.runtime) return Response.json({ error: "uninitialized" }, { status: 503 });
    return this.runtime.handleMcp(request);
  }
}

export class GiabanHttp extends WorkerEntrypoint<McpWorkerEnv> {
  async handleBrowserApi(envelope: BrowserApiEnvelope): Promise<BrowserApiResult> {
    if (!isBrowserActor(envelope?.actor)) return forbiddenActor();
    const stub = this.env.GIABAN_SHOP.get(this.env.GIABAN_SHOP.idFromName("owner"));
    return stub.handleBrowserApi(envelope);
  }
}

export default {
  async fetch(request: Request, env: McpWorkerEnv): Promise<Response> {
    const rejected = await rejectPublicMcpRequest(request, env);
    if (rejected) return rejected;
    const stub = env.GIABAN_SHOP.get(env.GIABAN_SHOP.idFromName("owner"));
    return stub.fetch(request);
  },
};
