import { GiabanApplication, legacyAdminContext, publicContext } from "../application/giaban.ts";
import { handleApiV1 } from "./adapter.ts";

export { MAX_API_BODY_BYTES } from "./limits.ts";
export const BROWSER_ACTORS = ["public", "legacyAdmin"] as const;
export type BrowserActor = (typeof BROWSER_ACTORS)[number];

const FORWARDED_HEADERS = new Set(["content-type", "idempotency-key", "if-match-revision"]);

export interface BrowserApiEnvelope {
  method: string;
  url: string;
  headerPairs: Array<[string, string]>;
  body: string | null;
  actor: BrowserActor;
  requestId: string;
}

export interface BrowserApiResult {
  status: number;
  headerPairs: Array<[string, string]>;
  body: string;
}

export const isBrowserActor = (value: unknown): value is BrowserActor =>
  value === "public" || value === "legacyAdmin";

const jsonResult = (body: unknown, status: number): BrowserApiResult => ({
  status,
  headerPairs: [
    ["content-type", "application/json"],
    ["cache-control", "no-store"],
    ["x-content-type-options", "nosniff"],
  ],
  body: JSON.stringify(body),
});

export const envelopeFromVerifiedRequest = (
  request: Request,
  actor: BrowserActor,
  body: string | null,
  requestId = crypto.randomUUID(),
): BrowserApiEnvelope => {
  const headerPairs: Array<[string, string]> = [];
  request.headers.forEach((value, key) => {
    if (FORWARDED_HEADERS.has(key.toLowerCase())) headerPairs.push([key, value]);
  });
  return {
    method: request.method,
    url: request.url,
    headerPairs,
    body,
    actor,
    requestId,
  };
};

export const resultToResponse = (result: BrowserApiResult): Response => {
  const headers = new Headers();
  for (const [key, value] of result.headerPairs) headers.append(key, value);
  return new Response(result.body, { status: result.status, headers });
};

export const responseToResult = async (response: Response): Promise<BrowserApiResult> => {
  const headerPairs: Array<[string, string]> = [];
  response.headers.forEach((value, key) => headerPairs.push([key, value]));
  return { status: response.status, headerPairs, body: await response.text() };
};

export const contextFromBrowserActor = (actor: BrowserActor, requestId: string) => {
  if (actor === "legacyAdmin") {
    return legacyAdminContext({ requestId, now: new Date(), clientId: "ksht-api" });
  }
  return publicContext({ requestId, now: new Date(), clientId: "ksht-api" });
};

export const dispatchBrowserApi = async (
  app: GiabanApplication,
  envelope: unknown,
): Promise<BrowserApiResult> => {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return jsonResult({ code: "FORBIDDEN", message: "Invalid internal actor", retryable: false }, 403);
  }
  const record = envelope as Record<string, unknown>;
  if (!isBrowserActor(record.actor)) {
    return jsonResult({ code: "FORBIDDEN", message: "Invalid internal actor", retryable: false }, 403);
  }
  if (typeof record.method !== "string" || typeof record.url !== "string" || typeof record.requestId !== "string") {
    return jsonResult({ code: "VALIDATION_ERROR", message: "Invalid internal envelope", retryable: false }, 400);
  }
  const headers = new Headers();
  if (Array.isArray(record.headerPairs)) {
    for (const pair of record.headerPairs) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const key = String(pair[0]);
      if (!FORWARDED_HEADERS.has(key.toLowerCase())) continue;
      headers.set(key, String(pair[1]));
    }
  }
  const body = typeof record.body === "string" ? record.body : null;
  const requestInit: RequestInit = { method: record.method, headers };
  if (record.method !== "GET" && record.method !== "HEAD") requestInit.body = body;
  const request = new Request(record.url, requestInit);
  const context = contextFromBrowserActor(record.actor, record.requestId);
  const response = await handleApiV1(request, app, context);
  if (!response) return jsonResult({ code: "NOT_FOUND", message: "Not Found", retryable: false }, 404);
  return responseToResult(response);
};
