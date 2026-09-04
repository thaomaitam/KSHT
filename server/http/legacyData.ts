import { DomainError } from "../domain/errors.ts";
import { GiabanApplication } from "../application/giaban.ts";
import type { InvocationContext } from "../safety/assertion.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const PUBLIC_KEYS = new Set(["products", "categories", "settings"]);

export const handleLegacyData = async (
  request: Request,
  app: GiabanApplication,
  context: InvocationContext,
): Promise<Response | null> => {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/data\/([^/]+)$/);
  if (!match) return null;
  const key = match[1];
  try {
    if (request.method === "GET") {
      if (key === "products") {
        const page = await app.query({ operationId: "listPublicProducts", input: {} }, context) as { items: unknown[] };
        return json(page.items);
      }
      if (key === "categories") {
        const page = await app.query({ operationId: "listPublicCategories", input: {} }, context) as { items: unknown[] };
        return json(page.items);
      }
      if (key === "settings") {
        return json(await app.query({ operationId: "getPublicSettings", input: {} }, context));
      }
      if (!PUBLIC_KEYS.has(key) && !context.legacy) {
        return json({ code: "UNAUTHENTICATED", message: "Authentication required", retryable: false }, 401);
      }
      return json({ code: "NOT_FOUND", message: "Unknown key", retryable: false }, 404);
    }
    if (request.method === "POST" || request.method === "PUT") {
      return json({
        code: "MIGRATION_READ_ONLY",
        message: "Whole-key writes are disabled. Use /api/v1 commands.",
        retryable: false,
      }, 423);
    }
    return json({ code: "VALIDATION_ERROR", message: "Method not allowed", retryable: false }, 405);
  } catch (error) {
    if (error instanceof DomainError) {
      return json(error.toJSON(), error.code === "UNAUTHENTICATED" ? 401 : 400);
    }
    return json({ code: "INTERNAL_ERROR", message: "Internal error", retryable: true }, 500);
  }
};
