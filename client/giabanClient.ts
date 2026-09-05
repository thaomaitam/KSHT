import { apiService } from "../apiService.ts";
import { parsePage, toListQuery, type ListQuery } from "./giabanPage.ts";
import { toReportRangeQuery } from "./giabanPayloads.ts";

export class CloudWriteError extends Error {
  code: string;
  status: number;
  retryable: boolean;
  nextAction?: string;

  constructor(message = "Cloud write failed", options: { code?: string; status?: number; retryable?: boolean; nextAction?: string } = {}) {
    super(message);
    this.name = "CloudWriteError";
    this.code = options.code || "INTERNAL_ERROR";
    this.status = options.status ?? 0;
    this.retryable = Boolean(options.retryable);
    this.nextAction = options.nextAction;
  }
}

const v1 = (path: string) => `${apiService.getApiUrl()}/api/v1${path}`;

const headers = (extra: Record<string, string> = {}): Record<string, string> => {
  const token = apiService.getSessionToken();
  return token
    ? { Authorization: `Bearer ${token}`, "content-type": "application/json", ...extra }
    : { "content-type": "application/json", ...extra };
};

const parseBody = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const throwIfFailed = async (response: Response): Promise<any> => {
  if (response.status === 401) apiService.clearSession();
  const body = await parseBody(response);
  if (response.ok) return body;
  throw new CloudWriteError(body?.message || `Giaban API HTTP ${response.status}`, {
    code: typeof body?.code === "string" ? body.code : "INTERNAL_ERROR",
    status: response.status,
    retryable: Boolean(body?.retryable),
    nextAction: typeof body?.nextAction === "string" ? body.nextAction : undefined,
  });
};

const offlineError = (error: unknown): CloudWriteError => {
  if (error instanceof CloudWriteError) return error;
  return new CloudWriteError(error instanceof Error ? error.message : "Không kết nối được máy chủ", {
    code: "OFFLINE",
    status: 0,
    retryable: true,
    nextAction: "Kiểm tra mạng rồi thử lại. Không ghi thành công cục bộ.",
  });
};

const read = async (path: string) => {
  try {
    const response = await fetch(v1(path), { headers: headers() });
    return throwIfFailed(response);
  } catch (error) {
    throw offlineError(error);
  }
};

const write = async (path: string, body: unknown = {}, init: { method?: string; idempotencyKey?: string; revision?: number } = {}) => {
  const extra: Record<string, string> = {};
  if (init.idempotencyKey) extra["Idempotency-Key"] = init.idempotencyKey;
  if (init.revision !== undefined) extra["If-Match-Revision"] = String(init.revision);
  try {
    const response = await fetch(v1(path), {
      method: init.method ?? "POST",
      headers: headers(extra),
      body: init.method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });
    return throwIfFailed(response);
  } catch (error) {
    throw offlineError(error);
  }
};

const itemsOf = (page: any): any[] => parsePage(page).items;

export const newIdempotencyKey = (): string => crypto.randomUUID();

export const giabanClient = {
  getStatus: () => read("/status"),
  getCapabilities: () => read("/capabilities"),
  getPublicProducts: (query: ListQuery = {}) => read(`/public/products?${toListQuery({ limit: 100, ...query })}`),
  getPublicCategories: () => read("/public/categories"),
  getPublicSettings: () => read("/public/settings"),
  listProducts: (includeArchived: boolean | ListQuery = false) => {
    const query = typeof includeArchived === "boolean" ? { includeArchived } : includeArchived;
    return read(`/products?${toListQuery({ limit: 100, ...query })}`);
  },
  getProduct: (id: string) => read(`/products/${id}`),
  createProduct: (input: unknown, idempotencyKey: string) => write("/products", input, { idempotencyKey }),
  updateProduct: (id: string, input: unknown, revision: number, idempotencyKey: string) =>
    write(`/products/${id}`, input, { method: "PATCH", revision, idempotencyKey }),
  archiveProduct: (id: string, idempotencyKey: string, revision?: number) =>
    write(`/products/${id}/archive`, {}, { idempotencyKey, revision }),
  restoreProduct: (id: string, idempotencyKey: string, revision?: number) =>
    write(`/products/${id}/restore`, {}, { idempotencyKey, revision }),
  listCategories: (includeArchived: boolean | ListQuery = false) => {
    const query = typeof includeArchived === "boolean" ? { includeArchived } : includeArchived;
    return read(`/categories?${toListQuery({ limit: 100, ...query })}`);
  },
  createCategory: (input: unknown, idempotencyKey: string) => write("/categories", input, { idempotencyKey }),
  updateCategory: (id: string, input: unknown, revision: number, idempotencyKey: string) =>
    write(`/categories/${id}`, input, { method: "PATCH", revision, idempotencyKey }),
  archiveCategory: (id: string, idempotencyKey: string, revision?: number) =>
    write(`/categories/${id}/archive`, {}, { idempotencyKey, revision }),
  restoreCategory: (id: string, idempotencyKey: string, revision?: number) =>
    write(`/categories/${id}/restore`, {}, { idempotencyKey, revision }),
  listCustomers: (query: ListQuery = {}) => read(`/customers?${toListQuery({ limit: 100, ...query })}`),
  getCustomer: (id: string) => read(`/customers/${id}`),
  createCustomer: (input: unknown, idempotencyKey: string) => write("/customers", input, { idempotencyKey }),
  updateCustomer: (id: string, input: unknown, revision: number, idempotencyKey: string) =>
    write(`/customers/${id}`, input, { method: "PATCH", revision, idempotencyKey }),
  archiveCustomer: (id: string, idempotencyKey: string, revision?: number) =>
    write(`/customers/${id}/archive`, {}, { idempotencyKey, revision }),
  listOrders: (query: ListQuery = {}) => read(`/orders?${toListQuery({ limit: 100, ...query })}`),
  getOrder: (id: string) => read(`/orders/${id}`),
  getOrderInvoice: (id: string) => read(`/orders/${id}/invoice`),
  createDraftOrder: (input: unknown, idempotencyKey: string) => write("/orders", input, { idempotencyKey }),
  updateDraftOrder: (id: string, input: unknown, revision: number, idempotencyKey: string) =>
    write(`/orders/${id}`, input, { method: "PATCH", revision, idempotencyKey }),
  confirmOrder: (id: string, revision: number, idempotencyKey: string) =>
    write(`/orders/${id}/confirm`, {}, { idempotencyKey, revision }),
  markOrderShipping: (id: string, revision: number, idempotencyKey: string) =>
    write(`/orders/${id}/shipping`, {}, { idempotencyKey, revision }),
  completeOrder: (id: string, revision: number, idempotencyKey: string) =>
    write(`/orders/${id}/complete`, {}, { idempotencyKey, revision }),
  cloneOrder: (id: string, idempotencyKey: string) => write(`/orders/${id}/clone`, {}, { idempotencyKey }),
  discardDraftOrder: (id: string, revision: number, idempotencyKey: string) =>
    write(`/orders/${id}/discard`, {}, { idempotencyKey, revision }),
  previewOrderCancellation: (id: string, reason: string) => write(`/orders/${id}/cancel/preview`, { reason }),
  confirmOrderCancellation: (orderId: string, confirmationToken: string) =>
    write(`/orders/${orderId}/cancel/confirm`, { confirmationToken }),
  recordPayment: (orderId: string, input: unknown, idempotencyKey: string) =>
    write(`/orders/${orderId}/payments`, input, { idempotencyKey }),
  listPayments: (query: ListQuery = {}) => read(`/payments?${toListQuery({ limit: 100, ...query })}`),
  listReceivables: (query: ListQuery = {}) => read(`/receivables?${toListQuery({ limit: 100, ...query })}`),
  previewPaymentRefund: (paymentId: string, amount: number, reason: string) =>
    write(`/payments/${paymentId}/refund/preview`, { amount, reason }),
  confirmPaymentRefund: (paymentId: string, confirmationToken: string) =>
    write(`/payments/${paymentId}/refund/confirm`, { confirmationToken }),
  listCashTransactions: (query: ListQuery = {}) => read(`/cash-transactions?${toListQuery({ limit: 100, ...query })}`),
  createCashTransaction: (input: unknown, idempotencyKey: string) => write("/cash-transactions", input, { idempotencyKey }),
  previewCashReversal: (transactionId: string, reason: string) =>
    write(`/cash-transactions/${transactionId}/reverse/preview`, { reason }),
  confirmCashReversal: (transactionId: string, confirmationToken: string) =>
    write(`/cash-transactions/${transactionId}/reverse/confirm`, { confirmationToken }),
  getReportSummary: (fromDate: string, toDate: string) => read(`/reports/summary?${toReportRangeQuery(fromDate, toDate)}`),
  getPhoneSettings: () => read("/settings/phone"),
  updatePhoneSettings: (input: unknown, revision: number, idempotencyKey: string) =>
    write("/settings/phone", input, { method: "PATCH", revision, idempotencyKey }),
  getShopSettings: () => read("/settings/shop"),
  updateShopSettings: (input: unknown, revision: number, idempotencyKey: string) =>
    write("/settings/shop", input, { method: "PATCH", revision, idempotencyKey }),
  getBankSettings: () => read("/settings/bank"),
  updateBankSettings: (input: unknown, revision: number, idempotencyKey: string) =>
    write("/settings/bank", input, { method: "PATCH", revision, idempotencyKey }),
  getTaxSettings: () => read("/settings/tax"),
  updateTaxSettings: (input: unknown, revision: number, idempotencyKey: string) =>
    write("/settings/tax", input, { method: "PATCH", revision, idempotencyKey }),
  listShopTemplates: (query: ListQuery = {}) => read(`/shop-templates?${toListQuery({ limit: 100, ...query })}`),
  createShopTemplate: (input: unknown, idempotencyKey: string) => write("/shop-templates", input, { idempotencyKey }),
  updateShopTemplate: (id: string, input: unknown, revision: number, idempotencyKey: string) =>
    write(`/shop-templates/${id}`, input, { method: "PATCH", revision, idempotencyKey }),
  archiveShopTemplate: (id: string, idempotencyKey: string, revision?: number) =>
    write(`/shop-templates/${id}/archive`, {}, { idempotencyKey, revision }),
  setDefaultShopTemplate: (id: string, revision: number, idempotencyKey: string) =>
    write(`/shop-templates/${id}/default`, {}, { idempotencyKey, revision }),
  itemsOf,
  parsePage,
};
