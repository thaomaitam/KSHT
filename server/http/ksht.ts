import legacyWorker, { presentedSessionToken, verifySessionToken } from "../../cloudflare_worker.js";
import {
  envelopeFromVerifiedRequest,
  resultToResponse,
  type BrowserActor,
  type BrowserApiEnvelope,
  type BrowserApiResult,
} from "./browserApi.ts";
import { ApiBodyError, MAX_API_BODY_BYTES, readApiBody } from "./limits.ts";
import { resolveApiV1Route } from "./adapter.ts";

export interface KshtEnv {
  ALLOWED_ORIGINS?: string;
  DOMAIN_AUTHORITATIVE?: string;
  SESSION_SIGNING_SECRET?: string;
  GIABAN?: {
    handleBrowserApi(envelope: BrowserApiEnvelope): Promise<BrowserApiResult>;
  };
  [key: string]: unknown;
}

const allowedOrigins = (env: KshtEnv): string[] =>
  String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);

const json = (body: unknown, status: number, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });

const withCors = (request: Request, env: KshtEnv, response: Response): Response => {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  if (!origin || !allowed.includes(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, If-Match-Revision, X-Admin-Secret");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  return new Response(response.body, { status: response.status, headers });
};

const unauthenticated = () =>
  json({ code: "UNAUTHENTICATED", message: "Authentication required", retryable: false }, 401);

export const handleKshtApi = async (request: Request, env: KshtEnv): Promise<Response> => {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const originAllowed = Boolean(origin && allowed.includes(origin));

  if (request.method === "OPTIONS") {
    if (!originAllowed) return new Response(null, { status: 403 });
    return withCors(request, env, new Response(null, { status: 204 }));
  }

  if (origin && !originAllowed) {
    return json({ error: "Origin not allowed" }, 403, { Vary: "Origin" });
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/v1/")) {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
      return withCors(request, env, json({ code: "VALIDATION_ERROR", message: "Request too large", retryable: false }, 413));
    }
    if (!env.GIABAN) {
      return withCors(request, env, json({
        code: "INTERNAL_ERROR",
        message: "Giaban coordinator unavailable",
        retryable: true,
      }, 503));
    }

    const token = presentedSessionToken(request);
    let actor: BrowserActor;
    if (token) {
      const valid = await verifySessionToken(token, env.SESSION_SIGNING_SECRET);
      if (!valid) return withCors(request, env, unauthenticated());
      actor = "legacyAdmin";
    } else {
      const route = resolveApiV1Route(request.method, url.pathname);
      if (route?.kind === "operation" && !route.public) return withCors(request, env, unauthenticated());
      actor = "public";
    }

    let body: string | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        body = await readApiBody(request);
      } catch (error) {
        const status = error instanceof ApiBodyError ? error.status : 400;
        const message = error instanceof ApiBodyError ? error.message : "Invalid request body";
        return withCors(request, env, json({ code: "VALIDATION_ERROR", message, retryable: false }, status));
      }
    }

    const envelope = envelopeFromVerifiedRequest(request, actor, body);
    try {
      const result = await env.GIABAN.handleBrowserApi(envelope);
      return withCors(request, env, resultToResponse(result));
    } catch {
      return withCors(request, env, json({ code: "INTERNAL_ERROR", message: "Internal error", retryable: true }, 500));
    }
  }

  return legacyWorker.fetch(request, env, {});
};
