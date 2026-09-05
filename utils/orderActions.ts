import { assertVnd } from "../server/domain/money.ts";

import { CloudWriteError, type Order, type PaymentRecord, type ShopTemplate } from "../businessService.ts";
import { createSubmitLock, isRetryableError } from "./operationState.ts";

export const INCOMPLETE_PAGES_MESSAGE =
  "Danh sách chưa tải đủ trang. Phần đang hiện có thể thiếu.";

export const REFUND_CONFIRM_MESSAGE =
  "Thao tác này chỉ ghi nhận số tiền đã hoàn trả bên ngoài, không chuyển khoản ngân hàng. Xác nhận ghi phiếu hoàn?";

export interface OrderHistoryNotice {
  kind: "error" | "warning";
  title?: string;
  message: string;
}

export interface OrderHistoryView {
  notice: OrderHistoryNotice | null;
  busy: boolean;
  expandedId: string | null;
  payments: PaymentRecord[];
  paymentsTruncated: boolean;
  payAmount: string;
  cancelReason: string;
}

export interface OrderHistoryDeps {
  getOrderInvoice: (id: string) => Promise<Order>;
  recordPayment: (
    orderId: string,
    amount: number,
    method: string,
    note: string | undefined,
    idempotencyKey: string,
  ) => Promise<PaymentRecord>;
  refundPayment: (paymentId: string, amount: number, reason: string) => Promise<PaymentRecord>;
  listPayments: (orderId: string) => Promise<{ items: PaymentRecord[]; truncated?: boolean }>;
}

const MISSING_SELLER_TEMPLATE: ShopTemplate = {
  id: "seller-snapshot-missing",
  name: "[Chưa có mẫu cửa hàng]",
  address: "[Vui lòng tạo mẫu trong Cài đặt]",
  phone: "",
};

const conflictCodes = new Set(["IDENTITY_CONFLICT", "IDEMPOTENCY_CONFLICT"]);

const noticeFromError = (error: unknown): OrderHistoryNotice => {
  if (error instanceof CloudWriteError) {
    return { kind: "error", title: error.code, message: error.message };
  }
  return {
    kind: "error",
    message: error instanceof Error ? error.message : "Thao tác thất bại.",
  };
};

const requireInvoiceDetail = (invoice: Order): Order => {
  if (!invoice || !Array.isArray(invoice.items) || invoice.items.length < 1) {
    throw new CloudWriteError("Không tải được chi tiết đơn (hóa đơn). Không in hoặc tạo lại từ bản tóm tắt.", {
      code: "INVOICE_REQUIRED",
      retryable: true,
    });
  }
  return invoice;
};

export const printShopTemplate = (invoice: Order): ShopTemplate => {
  const snap = invoice.sellerSnapshot;
  if (!snap || typeof snap !== "object") return MISSING_SELLER_TEMPLATE;
  const name = String(snap.name || "").trim();
  if (!name) return MISSING_SELLER_TEMPLATE;
  return {
    id: String(snap.id || "seller-snapshot"),
    name,
    address: String(snap.address || ""),
    phone: String(snap.phone || ""),
  };
};

const parsePaymentAmount = (raw: string): number => {
  const value = String(raw).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(value)) {
    throw new CloudWriteError("Số thu phải là số dương.", { code: "VALIDATION_ERROR", retryable: false });
  }
  try {
    const amount = assertVnd(Number(value), "amount");
    if (amount <= 0) {
      throw new CloudWriteError("Số thu phải là số dương.", { code: "VALIDATION_ERROR", retryable: false });
    }
    return amount;
  } catch (error) {
    if (error instanceof CloudWriteError) throw error;
    throw new CloudWriteError("Số thu phải là số dương.", { code: "VALIDATION_ERROR", retryable: false });
  }
};

const keepsPaymentKey = (error: unknown): boolean => {
  if (isRetryableError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return Boolean(code && conflictCodes.has(code));
};

export const createOrderHistoryActions = (deps: OrderHistoryDeps) => {
  let notice: OrderHistoryNotice | null = null;
  let busyAction: string | null = null;
  let expandedId: string | null = null;
  let payments: PaymentRecord[] = [];
  let paymentsTruncated = false;
  let payAmount = "";
  let cancelReason = "";
  let selectionGeneration = 0;
  let frozenPayment: { orderId: string; amount: number; method: string } | null = null;
  let paymentLock = createSubmitLock();

  const resetPaymentAttempt = () => {
    paymentLock = createSubmitLock();
    frozenPayment = null;
  };

  const snapshot = (): OrderHistoryView => ({
    notice,
    busy: Boolean(busyAction) || paymentLock.inFlight,
    expandedId,
    payments,
    paymentsTruncated,
    payAmount,
    cancelReason,
  });

  const beginBusy = (name: string): boolean => {
    if (busyAction || paymentLock.inFlight) return false;
    busyAction = name;
    notice = null;
    return true;
  };

  const endBusy = () => {
    busyAction = null;
  };

  const loadInvoice = async (summary: Order): Promise<Order | null> => {
    if (!beginBusy("invoice")) return null;
    try {
      const invoice = requireInvoiceDetail(await deps.getOrderInvoice(summary.id));
      notice = null;
      return invoice;
    } catch (error) {
      notice = noticeFromError(error);
      return null;
    } finally {
      endBusy();
    }
  };

  const reloadPaymentsIfCurrent = async (orderId: string, generation: number) => {
    const page = await deps.listPayments(orderId);
    if (generation !== selectionGeneration || expandedId !== orderId) return;
    payments = page.items;
    paymentsTruncated = Boolean(page.truncated);
  };

  return {
    snapshot,
    setPayAmount(value: string) {
      payAmount = value;
    },
    setCancelReason(value: string) {
      cancelReason = value;
    },
    async run<T>(name: string, work: () => Promise<T>): Promise<T | null> {
      if (!beginBusy(name)) return null;
      try {
        const result = await work();
        notice = null;
        return result;
      } catch (error) {
        notice = noticeFromError(error);
        return null;
      } finally {
        endBusy();
      }
    },
    loadInvoiceForPrint: loadInvoice,
    loadInvoiceForRecreate: loadInvoice,
    async expandOrder(orderId: string): Promise<void> {
      if (frozenPayment || paymentLock.inFlight) {
        notice = { kind: "warning", message: "Phiếu thu chưa rõ kết quả. Thử lại nguyên số tiền đã gửi trước khi đổi đơn; không tạo phiếu mới." };
        return;
      }
      if (expandedId === orderId) {
        selectionGeneration += 1;
        expandedId = null;
        payments = [];
        paymentsTruncated = false;
        payAmount = "";
        cancelReason = "";
        resetPaymentAttempt();
        return;
      }
      const generation = (selectionGeneration += 1);
      expandedId = orderId;
      payments = [];
      paymentsTruncated = false;
      payAmount = "";
      cancelReason = "";
      resetPaymentAttempt();
      notice = null;
      try {
        await reloadPaymentsIfCurrent(orderId, generation);
      } catch (error) {
        if (generation !== selectionGeneration || expandedId !== orderId) return;
        notice = noticeFromError(error);
      }
    },
    async recordPayment(orderId: string, method = "cash"): Promise<PaymentRecord | null> {
      if (busyAction) return null;
      let amount: number;
      try {
        amount = parsePaymentAmount(payAmount);
      } catch (error) {
        notice = noticeFromError(error);
        return null;
      }
      const lock = paymentLock;
      const key = lock.begin();
      if (!key) return null;
      const nextPayload = { orderId, amount, method };
      if (frozenPayment && JSON.stringify(frozenPayment) !== JSON.stringify(nextPayload)) {
        notice = {
          kind: "error",
          title: "IDEMPOTENCY_CONFLICT",
          message: "Phiếu thu đang chờ thử lại. Giữ nguyên số tiền đã gửi; không tạo phiếu mới khi chưa rõ kết quả.",
        };
        lock.failRetryable();
        return null;
      }
      frozenPayment = nextPayload;
      const generation = selectionGeneration;
      try {
        const recorded = await deps.recordPayment(orderId, amount, method, undefined, key);
        if (lock === paymentLock) {
          lock.succeed();
          frozenPayment = null;
          payAmount = "";
          notice = null;
        }
        if (expandedId === orderId && generation === selectionGeneration) {
          try {
            await reloadPaymentsIfCurrent(orderId, generation);
          } catch (error) {
            if (generation !== selectionGeneration || expandedId !== orderId) return recorded;
            notice = noticeFromError(error);
          }
        }
        return recorded;
      } catch (error) {
        if (lock !== paymentLock) return null;
        notice = noticeFromError(error);
        if (keepsPaymentKey(error)) lock.failRetryable();
        else {
          lock.failTerminal();
          frozenPayment = null;
        }
        return null;
      }
    },
    async refundRemaining(
      orderId: string,
      payment: PaymentRecord,
      reason: string,
      confirmed: boolean,
    ): Promise<PaymentRecord | null> {
      if (!confirmed) return null;
      if (expandedId !== orderId || payment.orderId !== orderId) return null;
      const trimmed = reason.trim();
      if (!trimmed) {
        notice = { kind: "error", message: "Cần lý do hoàn." };
        return null;
      }
      if (!beginBusy("refund")) return null;
      const generation = selectionGeneration;
      try {
        const refunded = await deps.refundPayment(payment.id, payment.remaining, trimmed);
        notice = null;
        if (expandedId === orderId && generation === selectionGeneration) {
          await reloadPaymentsIfCurrent(orderId, generation);
        }
        return refunded;
      } catch (error) {
        if (generation !== selectionGeneration || expandedId !== orderId) return null;
        notice = noticeFromError(error);
        return null;
      } finally {
        endBusy();
      }
    },
  };
};

export type OrderHistoryActions = ReturnType<typeof createOrderHistoryActions>;
