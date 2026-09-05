import { DomainError } from "../domain/errors.ts";
import { GiabanApplication } from "../application/giaban.ts";
import { operationById } from "../application/registry.ts";
import type { InvocationContext } from "../safety/assertion.ts";
import { ApiBodyError, readApiBody } from "./limits.ts";

const HTTP_STATUS: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REVISION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_TRANSITION: 409,
  CONFIRMATION_REQUIRED: 409,
  CONFIRMATION_EXPIRED: 409,
  CONFIRMATION_STALE: 409,
  RATE_LIMITED: 429,
  MIGRATION_READ_ONLY: 423,
  INTERNAL_ERROR: 500,
};

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra,
    },
  });

const EXACT: Array<[string, string, string]> = [
  ["GET", "/api/v1/status", "getStatus"],
  ["GET", "/api/v1/capabilities", "getCapabilities"],
  ["GET", "/api/v1/public/products", "listPublicProducts"],
  ["GET", "/api/v1/public/categories", "listPublicCategories"],
  ["GET", "/api/v1/public/settings", "getPublicSettings"],
  ["GET", "/api/v1/products", "listProducts"],
  ["POST", "/api/v1/products", "createProduct"],
  ["GET", "/api/v1/categories", "listCategories"],
  ["POST", "/api/v1/categories", "createCategory"],
  ["GET", "/api/v1/customers", "listCustomers"],
  ["POST", "/api/v1/customers", "createCustomer"],
  ["POST", "/api/v1/customers/merge/preview", "previewCustomerMerge"],
  ["POST", "/api/v1/customers/merge/confirm", "confirmCustomerMerge"],
  ["POST", "/api/v1/customers/unmerge/preview", "previewCustomerUnmerge"],
  ["POST", "/api/v1/customers/unmerge/confirm", "confirmCustomerUnmerge"],
  ["GET", "/api/v1/orders", "listOrders"],
  ["POST", "/api/v1/orders", "createDraftOrder"],
  ["GET", "/api/v1/payments", "listPayments"],
  ["GET", "/api/v1/receivables", "listReceivables"],
  ["GET", "/api/v1/cash-transactions", "listCashTransactions"],
  ["POST", "/api/v1/cash-transactions", "createCashTransaction"],
  ["GET", "/api/v1/reports/summary", "getReportSummary"],
  ["GET", "/api/v1/reports/confirmed-sales", "getConfirmedSalesReport"],
  ["GET", "/api/v1/reports/receipts", "getReceiptsReport"],
  ["GET", "/api/v1/reports/receivables", "getReceivablesReport"],
  ["GET", "/api/v1/reports/discounts-shipping", "getDiscountsShippingReport"],
  ["GET", "/api/v1/reports/cogs-profit", "getCogsProfitReport"],
  ["GET", "/api/v1/settings/phone", "getPhoneSettings"],
  ["PATCH", "/api/v1/settings/phone", "updatePhoneSettings"],
  ["GET", "/api/v1/settings/shop", "getShopSettings"],
  ["PATCH", "/api/v1/settings/shop", "updateShopSettings"],
  ["GET", "/api/v1/settings/bank", "getBankSettings"],
  ["PATCH", "/api/v1/settings/bank", "updateBankSettings"],
  ["GET", "/api/v1/settings/tax", "getTaxSettings"],
  ["PATCH", "/api/v1/settings/tax", "updateTaxSettings"],
  ["GET", "/api/v1/shop-templates", "listShopTemplates"],
  ["POST", "/api/v1/shop-templates", "createShopTemplate"],
  ["POST", "/api/v1/backups/export/preview", "previewBackupExport"],
  ["POST", "/api/v1/backups/export/confirm", "confirmBackupExport"],
  ["POST", "/api/v1/backups/uploads", "createBackupUploadIntent"],
  ["POST", "/api/v1/restores/preview", "previewRestore"],
  ["POST", "/api/v1/restores/confirm", "confirmRestore"],
  ["POST", "/api/v1/migrations/live-reconciliation/preview", "previewLiveReconciliation"],
  ["POST", "/api/v1/migrations/live-reconciliation/confirm", "confirmLiveReconciliation"],
  ["GET", "/api/v1/audit-events", "searchAuditEvents"],
];

const PATTERNS: Array<[string, RegExp, string, string]> = [
  ["GET", /^\/api\/v1\/public\/products\/([^/]+)$/, "getPublicProduct", "productId"],
  ["GET", /^\/api\/v1\/products\/([^/]+)$/, "getProduct", "productId"],
  ["PATCH", /^\/api\/v1\/products\/([^/]+)$/, "updateProduct", "productId"],
  ["POST", /^\/api\/v1\/products\/([^/]+)\/archive$/, "archiveProduct", "productId"],
  ["POST", /^\/api\/v1\/products\/([^/]+)\/restore$/, "restoreProduct", "productId"],
  ["GET", /^\/api\/v1\/categories\/([^/]+)$/, "listCategories", "categoryId"],
  ["PATCH", /^\/api\/v1\/categories\/([^/]+)$/, "updateCategory", "categoryId"],
  ["POST", /^\/api\/v1\/categories\/([^/]+)\/archive$/, "archiveCategory", "categoryId"],
  ["POST", /^\/api\/v1\/categories\/([^/]+)\/restore$/, "restoreCategory", "categoryId"],
  ["GET", /^\/api\/v1\/customers\/([^/]+)$/, "getCustomer", "customerId"],
  ["PATCH", /^\/api\/v1\/customers\/([^/]+)$/, "updateCustomer", "customerId"],
  ["POST", /^\/api\/v1\/customers\/([^/]+)\/archive$/, "archiveCustomer", "customerId"],
  ["POST", /^\/api\/v1\/customers\/([^/]+)\/restore$/, "restoreCustomer", "customerId"],
  ["GET", /^\/api\/v1\/orders\/([^/]+)$/, "getOrder", "orderId"],
  ["PATCH", /^\/api\/v1\/orders\/([^/]+)$/, "updateDraftOrder", "orderId"],
  ["GET", /^\/api\/v1\/orders\/([^/]+)\/invoice$/, "getOrderInvoice", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/confirm$/, "confirmOrder", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/shipping$/, "markOrderShipping", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/complete$/, "completeOrder", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/clone$/, "cloneOrder", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/discard$/, "discardDraftOrder", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/restore-draft$/, "restoreDraftOrder", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/cancel\/preview$/, "previewOrderCancellation", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/cancel\/confirm$/, "confirmOrderCancellation", "orderId"],
  ["POST", /^\/api\/v1\/orders\/([^/]+)\/payments$/, "recordPayment", "orderId"],
  ["POST", /^\/api\/v1\/payments\/([^/]+)\/reverse\/preview$/, "previewPaymentReversal", "paymentId"],
  ["POST", /^\/api\/v1\/payments\/([^/]+)\/reverse\/confirm$/, "confirmPaymentReversal", "paymentId"],
  ["POST", /^\/api\/v1\/payments\/([^/]+)\/refund\/preview$/, "previewPaymentRefund", "paymentId"],
  ["POST", /^\/api\/v1\/payments\/([^/]+)\/refund\/confirm$/, "confirmPaymentRefund", "paymentId"],
  ["POST", /^\/api\/v1\/cash-transactions\/([^/]+)\/reverse\/preview$/, "previewCashReversal", "transactionId"],
  ["POST", /^\/api\/v1\/cash-transactions\/([^/]+)\/reverse\/confirm$/, "confirmCashReversal", "transactionId"],
  ["PATCH", /^\/api\/v1\/shop-templates\/([^/]+)$/, "updateShopTemplate", "templateId"],
  ["POST", /^\/api\/v1\/shop-templates\/([^/]+)\/archive$/, "archiveShopTemplate", "templateId"],
  ["POST", /^\/api\/v1\/shop-templates\/([^/]+)\/restore$/, "restoreShopTemplate", "templateId"],
  ["POST", /^\/api\/v1\/shop-templates\/([^/]+)\/default$/, "setDefaultShopTemplate", "templateId"],
  ["GET", /^\/api\/v1\/backups\/([^/]+)$/, "getBackupManifest", "backupId"],
  ["POST", /^\/api\/v1\/backups\/([^/]+)\/download-grants$/, "createBackupDownloadGrant", "backupId"],
  ["POST", /^\/api\/v1\/backups\/uploads\/([^/]+)\/finalize$/, "finalizeBackupUpload", "uploadId"],
];

const coerceSearchParam = (key: string, value: string): unknown => {
  if (key === "limit" && /^[0-9]+$/.test(value)) return Number(value);
  if (key === "includeArchived") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return value;
};

const pathToOperation = (method: string, pathname: string): { operationId: string; params: Record<string, string> } | null => {
  for (const [routeMethod, routePath, operationId] of EXACT) {
    if (method === routeMethod && pathname === routePath) return { operationId, params: {} };
  }
  for (const [routeMethod, regex, operationId, param] of PATTERNS) {
    if (method !== routeMethod) continue;
    const match = pathname.match(regex);
    if (match) {
      try {
        const value = decodeURIComponent(match[1]);
        return { operationId, params: { [param]: value, id: value } };
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const resolveApiV1Route = (method: string, pathname: string) => {
  const mapped = pathToOperation(method, pathname);
  if (!mapped) {
    if (pathname.startsWith("/api/v1/")) return { kind: "unknown" as const };
    return null;
  }
  const policy = operationById.get(mapped.operationId);
  if (!policy) return { kind: "unknown" as const };
  return { kind: "operation" as const, operationId: mapped.operationId, public: Boolean(policy.public) };
};

export const handleApiV1 = async (
  request: Request,
  app: GiabanApplication,
  context: InvocationContext,
): Promise<Response | null> => {
  const url = new URL(request.url);
  const mapped = pathToOperation(request.method, url.pathname);
  if (!mapped) {
    if (url.pathname.startsWith("/api/v1/")) return json({ code: "NOT_FOUND", message: "Not Found", retryable: false }, 404);
    return null;
  }
  const policy = operationById.get(mapped.operationId);
  if (!policy) return json({ code: "NOT_FOUND", message: "Not Found", retryable: false }, 404);
  let body: Record<string, unknown> = {};
  if (request.method !== "GET" && request.method !== "HEAD") {
    let text: string;
    try {
      text = await readApiBody(request);
    } catch (error) {
      const status = error instanceof ApiBodyError ? error.status : 400;
      const message = error instanceof ApiBodyError ? error.message : "Invalid request body";
      return json({ code: "VALIDATION_ERROR", message, retryable: false }, status);
    }
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return json({ code: "VALIDATION_ERROR", message: "JSON object body required", retryable: false }, 400);
        }
        body = parsed as Record<string, unknown>;
      } catch {
        return json({ code: "VALIDATION_ERROR", message: "Invalid JSON", retryable: false }, 400);
      }
    }
  }
  for (const [key, value] of url.searchParams.entries()) body[key] = coerceSearchParam(key, value);
  const input = { ...body, ...mapped.params };
  const invoked = {
    ...context,
    idempotencyKey: request.headers.get("Idempotency-Key") ?? context.idempotencyKey,
    expectedRevision: request.headers.get("If-Match-Revision")
      ? Number(request.headers.get("If-Match-Revision"))
      : context.expectedRevision,
    confirmationToken: typeof body.confirmationToken === "string" ? body.confirmationToken : context.confirmationToken,
  };
  try {
    const result = await app.invoke(policy.kind, mapped.operationId, input, invoked);
    const status = request.method === "POST" && policy.kind === "command" ? 201 : 200;
    return json(result, status);
  } catch (error) {
    if (error instanceof DomainError) {
      return json(error.toJSON(), HTTP_STATUS[error.code] ?? 400);
    }
    return json({ code: "INTERNAL_ERROR", message: "Internal error", retryable: true }, 500);
  }
};
