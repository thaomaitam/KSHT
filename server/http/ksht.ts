import legacyWorker from "../../cloudflare_worker.js";
import { GiabanApplication, legacyAdminContext, publicContext } from "../application/giaban.ts";
import type { InvocationContext } from "../safety/assertion.ts";
import { handleApiV1 } from "./adapter.ts";
import { handleLegacyData } from "./legacyData.ts";

export interface KshtEnv {
  ALLOWED_ORIGINS?: string;
  DOMAIN_AUTHORITATIVE?: string;
  [key: string]: unknown;
}

const withCors = (request: Request, env: KshtEnv, response: Response): Response => {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, If-Match-Revision");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  return new Response(response.body, { status: response.status, headers });
};

export const contextFromApiRequest = (request: Request): InvocationContext => {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return legacyAdminContext({ requestId: crypto.randomUUID(), now: new Date() });
  return publicContext({ requestId: crypto.randomUUID(), now: new Date() });
};

export const handleKshtApi = async (
  request: Request,
  env: KshtEnv,
  app: GiabanApplication,
  context: InvocationContext,
): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return withCors(request, env, new Response(null, { status: 204 }));
  }
  const v1 = await handleApiV1(request, app, context);
  if (v1) return withCors(request, env, v1);
  if (env.DOMAIN_AUTHORITATIVE === "1") {
    const compatibility = await handleLegacyData(request, app, context);
    if (compatibility) return withCors(request, env, compatibility);
  }
  return withCors(request, env, await legacyWorker.fetch(request, env, {}));
};
