import { giabanClient, newIdempotencyKey, CloudWriteError } from './client/giabanClient.ts';
import { collectPages } from './client/giabanPage.ts';
import { stepKey } from './utils/operationState.ts';
import {
  toCashTransactionWrite,
  toCustomerWrite,
  toDraftOrderWrite,
  toPaymentWrite,
  toShopTemplateWrite,
} from './client/giabanPayloads.ts';

export type OrderStatus = 'draft' | 'confirmed' | 'shipping' | 'completed' | 'cancelled' | 'discarded';

export interface Order {
    id: string;
    customerId?: string;
    customerName: string;
    phone: string;
    address: string;
    items: any[];
    total: number;
    status: OrderStatus;
    createdAt: string;
    paymentMethod: 'cod' | 'banking';
    note?: string;
    shippingFee?: number;
    discount?: number;
    revision?: number;
    netCollected?: number;
    outstanding?: number;
    shopTemplateId?: string;
    reviewFlags?: string[];
    totalAmountInWords?: string;
    sellerSnapshot?: {
        id?: string;
        name?: string;
        address?: string;
        phone?: string;
    };
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    address: string;
    revision?: number;
    duplicatePhoneWarning?: boolean;
    outstanding?: number;
    outstandingComplete?: boolean;
    piiComplete?: boolean;
}

export interface PaymentRecord {
    id: string;
    orderId: string;
    amount: number;
    reversedAmount: number;
    refundedAmount: number;
    remaining: number;
    method: string;
    note?: string;
    createdAt: string;
}

export interface Transaction {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    description: string;
    date: string;
    category: string;
}

export interface BankInfo {
    bankName: string;
    accountNumber: string;
    accountName: string;
    qrCodeUrl?: string;
    revision?: number;
}

export interface ShopTemplate {
    id: string;
    name: string;
    address: string;
    phone: string;
    isDefault?: boolean;
    archived?: boolean;
    revision?: number;
}

export interface ReportSummary {
    fromDate: string;
    toDate: string;
    timezone: string;
    confirmedSales: number;
    grossReceipts: number;
    refunds: number;
    netReceipts: number;
    receivables: number;
    discounts: number;
    shippingFees: number;
    cogs: number;
    profit: number;
}

export interface HistoricalReview {
    ready: boolean;
    count: number;
    canRepair: boolean;
    message: string;
    types: Array<{ type: string; count: number }>;
}

export interface ListedPage<T> {
    items: T[];
    truncated: boolean;
    complete?: boolean;
    reason?: string;
}

const DOMAIN_STATUSES = new Set<OrderStatus>(['draft', 'confirmed', 'shipping', 'completed', 'cancelled', 'discarded']);

export const requireCustomerId = (customerId: string | undefined | null): string => {
    const id = String(customerId || '').trim();
    if (!id) throw new Error('customerId is required; chọn khách hiện có hoặc tạo khách mới, không khớp mờ.');
    return id;
};

export const mapOrderFromInvoice = (row: any): Order => {
    const contact = row.contact || {};
    const statusRaw = String(row.status || 'draft');
    const status = DOMAIN_STATUSES.has(statusRaw as OrderStatus) ? statusRaw as OrderStatus : 'draft';
    const reviewFlags: string[] = [];
    if (!row.customerId) reviewFlags.push('customer_id_requires_review');
    return {
        id: String(row.id),
        customerId: row.customerId ? String(row.customerId) : undefined,
        customerName: String(contact.name || contact.displayName || ''),
        phone: String(contact.phone || contact.phoneMasked || ''),
        address: String(contact.address || ''),
        items: (row.items || []).map((item: any) => ({
            ...item,
            total: Number(item.saleSubtotal ?? item.total) || 0,
        })),
        total: Number(row.total) || 0,
        status,
        createdAt: String(row.createdAt || ''),
        paymentMethod: row.paymentMethod === 'banking' ? 'banking' : 'cod',
        note: row.note ? String(row.note) : '',
        shippingFee: Number(row.shippingFee) || 0,
        discount: Number(row.discount) || 0,
        shopTemplateId: row.shopTemplateId ? String(row.shopTemplateId) : undefined,
        revision: Number(row.revision) || 1,
        netCollected: Number(row.netCollected) || 0,
        outstanding: Number(row.outstanding) || 0,
        reviewFlags,
        sellerSnapshot: row.sellerSnapshot && typeof row.sellerSnapshot === 'object'
            ? {
                id: row.sellerSnapshot.id ? String(row.sellerSnapshot.id) : undefined,
                name: String(row.sellerSnapshot.name || ''),
                address: String(row.sellerSnapshot.address || ''),
                phone: String(row.sellerSnapshot.phone || ''),
            }
            : undefined,
    };
};

export const mapReportSummary = (row: any): ReportSummary => ({
    fromDate: String(row.fromDate || ''),
    toDate: String(row.toDate || ''),
    timezone: String(row.timezone || 'Asia/Ho_Chi_Minh'),
    confirmedSales: Number(row.confirmedSales) || 0,
    grossReceipts: Number(row.grossReceipts) || 0,
    refunds: Number(row.refunds) || 0,
    netReceipts: Number(row.netReceipts) || 0,
    receivables: Number(row.receivables) || 0,
    discounts: Number(row.discounts) || 0,
    shippingFees: Number(row.shippingFees) || 0,
    cogs: Number(row.cogs) || 0,
    profit: Number(row.profit) || 0,
});

export const historicalReviewFromStatus = (row: any): HistoricalReview => {
    const types = Array.isArray(row?.migrationBlockerSummary)
        ? row.migrationBlockerSummary
            .filter((item: any) => typeof item?.type === 'string' && Number(item.count) > 0)
            .map((item: any) => ({ type: String(item.type), count: Number(item.count) }))
        : [];
    const count = Number(row?.migrationBlockerCount) || types.reduce((sum: number, item: { count: number }) => sum + item.count, 0);
    const ready = Boolean(row?.migrationReady) && count === 0;
    return {
        ready,
        count,
        canRepair: false,
        types,
        message: ready
            ? 'Không còn mục lịch sử cần rà soát.'
            : `Còn ${count} mục lịch sử cần rà soát. Giao diện không tự sửa định danh hoặc tiền.`,
    };
};

const mapPayment = (row: any): PaymentRecord => ({
    id: String(row.id),
    orderId: String(row.orderId || ''),
    amount: Number(row.amount) || 0,
    reversedAmount: Number(row.reversedAmount) || 0,
    refundedAmount: Number(row.refundedAmount) || 0,
    remaining: Number(row.remaining ?? ((Number(row.amount) || 0) - (Number(row.reversedAmount) || 0) - (Number(row.refundedAmount) || 0))),
    method: String(row.method || ''),
    note: row.note ? String(row.note) : '',
    createdAt: String(row.createdAt || ''),
});

export const mapOrderFromList = (row: any): Order => {
    if (row?.contact || Array.isArray(row?.items)) return mapOrderFromInvoice(row);
    const statusRaw = String(row.status || 'draft');
    const status = DOMAIN_STATUSES.has(statusRaw as OrderStatus) ? statusRaw as OrderStatus : 'draft';
    return {
        id: String(row.id),
        customerId: row.customerId ? String(row.customerId) : undefined,
        customerName: String(row.customerName || row.displayName || ''),
        phone: String(row.phone || row.phoneMasked || ''),
        address: String(row.address || ''),
        items: [],
        total: Number(row.total) || 0,
        status,
        createdAt: String(row.createdAt || ''),
        paymentMethod: row.paymentMethod === 'banking' ? 'banking' : 'cod',
        note: '',
        shippingFee: Number(row.shippingFee) || 0,
        discount: Number(row.discount) || 0,
        revision: Number(row.revision) || 1,
        netCollected: Number(row.netCollected) || 0,
        outstanding: Number(row.outstanding) || 0,
        reviewFlags: row.customerId ? [] : ['customer_id_requires_review'],
    };
};

const listedFrom = <T>(collected: Awaited<ReturnType<typeof collectPages>>, map: (row: any) => T): ListedPage<T> => ({
    items: collected.items.map(map),
    truncated: collected.truncated,
    complete: collected.complete,
    reason: collected.reason,
});

const placeOrderPayloads = new Map<string, string>();
const paymentPayloads = new Map<string, string>();

const freezePlaceOrderPayload = (operationId: string, payload: unknown) => {
    const encoded = JSON.stringify(payload);
    const previous = placeOrderPayloads.get(operationId);
    if (previous !== undefined && previous !== encoded) {
        throw new CloudWriteError(
            'Đơn đang chờ thử lại với nội dung khác. Giữ nguyên đơn đã gửi hoặc bắt đầu thao tác mới.',
            { code: 'IDEMPOTENCY_CONFLICT', retryable: false },
        );
    }
    placeOrderPayloads.set(operationId, encoded);
};

const freezePaymentPayload = (idempotencyKey: string, payload: unknown) => {
    const encoded = JSON.stringify(payload);
    const previous = paymentPayloads.get(idempotencyKey);
    if (previous !== undefined && previous !== encoded) {
        throw new CloudWriteError(
            'Phiếu thu đang chờ thử lại với số tiền đã gửi. Giữ nguyên số tiền hoặc bắt đầu thao tác mới.',
            { code: 'IDEMPOTENCY_CONFLICT', retryable: false },
        );
    }
    paymentPayloads.set(idempotencyKey, encoded);
};

let lastTaxRevision: number | undefined;

const requireRevision = (revision: unknown, message: string): number => {
    const value = Number(revision);
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new CloudWriteError(message, { code: 'REVISION_REQUIRED', retryable: false });
    }
    return value;
};

export const businessService = {
    async getStatusReview(): Promise<HistoricalReview> {
        try {
            return historicalReviewFromStatus(await giabanClient.getStatus());
        } catch {
            return {
                ready: false,
                count: 0,
                canRepair: false,
                types: [],
                message: 'Không đọc được getStatus. Không giả định dữ liệu lịch sử đã sạch.',
            };
        }
    },

    async getOrders(): Promise<ListedPage<Order>> {
        const collected = await collectPages((cursor) => giabanClient.listOrders({ cursor }));
        const listed = listedFrom(collected, mapOrderFromList);
        return {
            ...listed,
            items: listed.items.filter((order) => order.status !== 'discarded'),
        };
    },

    async getOrderInvoice(id: string): Promise<Order> {
        return mapOrderFromInvoice(await giabanClient.getOrderInvoice(id));
    },

    async placeOrder(input: {
        customerId?: string;
        customerName: string;
        phone: string;
        address: string;
        items: any[];
        shippingFee: number;
        discount: number;
        note: string;
        shopTemplateId?: string;
        collectAmount: number;
        confirm: boolean;
        paymentMethod?: 'cod' | 'banking';
        totalAmountInWords?: string;
        idempotencyKey?: string;
    }): Promise<Order> {
        const customerId = requireCustomerId(input.customerId);
        const operationId = input.idempotencyKey || newIdempotencyKey();
        const payload = {
            customerId,
            customerName: input.customerName,
            phone: input.phone,
            address: input.address,
            items: input.items,
            shippingFee: input.shippingFee,
            discount: input.discount,
            note: input.note,
            shopTemplateId: input.shopTemplateId,
            collectAmount: input.collectAmount,
            confirm: input.confirm,
            paymentMethod: input.paymentMethod,
            totalAmountInWords: input.totalAmountInWords,
        };
        freezePlaceOrderPayload(operationId, payload);
        const draft = await giabanClient.createDraftOrder(toDraftOrderWrite({
            customerId,
            contactSnapshot: { name: input.customerName, phone: input.phone, address: input.address },
            items: input.items.map((item) => ({
                productId: item.productId || null,
                name: item.name,
                unit: item.unit,
                quantity: Number(item.quantity) || 0,
                soCuon: Number(item.soCuon) > 0 ? Number(item.soCuon) : null,
                soKi: Number(item.soKi) > 0 ? Number(item.soKi) : null,
                unitPrice: Number(item.unitPrice) || 0,
                costPrice: Number(item.costPrice) || 0,
                isManual: Boolean(item.isManual),
            })),
            discount: input.discount,
            shippingFee: input.shippingFee,
            note: input.note,
            shopTemplateId: input.shopTemplateId && input.shopTemplateId !== 'default' ? input.shopTemplateId : undefined,
            totalAmountInWords: input.totalAmountInWords,
            paymentMethod: input.paymentMethod,
        }), stepKey(operationId, 'draft'));
        if (!input.confirm) {
            return mapOrderFromInvoice(draft);
        }
        const confirmed = await giabanClient.confirmOrder(String(draft.id), Number(draft.revision) || 1, stepKey(operationId, 'confirm'));
        if (input.collectAmount > 0) {
            await giabanClient.recordPayment(String(confirmed.id), toPaymentWrite({
                amount: input.collectAmount,
                method: input.paymentMethod === 'banking' ? 'banking' : 'cash',
            }), stepKey(operationId, 'payment'));
        }
        return mapOrderFromInvoice(await giabanClient.getOrderInvoice(String(confirmed.id)));
    },

    async createCustomer(input: { name: string; phone: string; address: string }, idempotencyKey?: string) {
        return giabanClient.createCustomer(toCustomerWrite(input), idempotencyKey || newIdempotencyKey());
    },

    async searchCustomers(q: string) {
        const collected = await collectPages((cursor) => giabanClient.listCustomers({ q, cursor }));
        return listedFrom(collected, (row: any) => ({
            id: String(row.id),
            name: String(row.displayName || row.name || ''),
            phone: String(row.phoneMasked || row.phone || ''),
            address: '',
            revision: Number(row.revision) || 1,
            duplicatePhoneWarning: Boolean(row.duplicatePhoneWarning),
            piiComplete: false,
        }));
    },

    async loadCustomer(id: string): Promise<Customer> {
        const row = await giabanClient.getCustomer(id);
        return {
            id: String(row.id),
            name: String(row.name || ''),
            phone: String(row.phone || ''),
            address: String(row.address || ''),
            revision: Number(row.revision) || 1,
            duplicatePhoneWarning: Boolean(row.duplicatePhoneWarning),
            piiComplete: true,
        };
    },

    async transitionOrder(order: Order, target: 'confirmed' | 'shipping' | 'completed'): Promise<ListedPage<Order>> {
        const revision = order.revision || 1;
        const key = `${order.id}:${target}:${revision}`;
        if (target === 'confirmed') await giabanClient.confirmOrder(order.id, revision, key);
        if (target === 'shipping') await giabanClient.markOrderShipping(order.id, revision, key);
        if (target === 'completed') await giabanClient.completeOrder(order.id, revision, key);
        return this.getOrders();
    },

    async discardDraft(order: Order): Promise<ListedPage<Order>> {
        const revision = order.revision || 1;
        await giabanClient.discardDraftOrder(order.id, revision, `${order.id}:discard:${revision}`);
        return this.getOrders();
    },

    async cancelOrder(orderId: string, reason: string): Promise<ListedPage<Order>> {
        const preview = await giabanClient.previewOrderCancellation(orderId, reason);
        if (Array.isArray(preview.blockers) && preview.blockers.length > 0) {
            throw new CloudWriteError(preview.blockers.join('; '), { code: 'INVALID_TRANSITION' });
        }
        await giabanClient.confirmOrderCancellation(orderId, String(preview.confirmationToken));
        return this.getOrders();
    },

    async listPayments(orderId: string): Promise<ListedPage<PaymentRecord>> {
        const collected = await collectPages((cursor) => giabanClient.listPayments({ orderId, cursor }));
        return listedFrom(collected, mapPayment);
    },

    async recordPayment(orderId: string, amount: number, method: string, note?: string, idempotencyKey?: string): Promise<PaymentRecord> {
        const key = idempotencyKey || newIdempotencyKey();
        freezePaymentPayload(key, { orderId, amount, method, note: note || '' });
        return mapPayment(await giabanClient.recordPayment(orderId, toPaymentWrite({ amount, method, note }), key));
    },

    async refundPayment(paymentId: string, amount: number, reason: string): Promise<PaymentRecord> {
        const preview = await giabanClient.previewPaymentRefund(paymentId, amount, reason);
        return mapPayment(await giabanClient.confirmPaymentRefund(paymentId, String(preview.confirmationToken)));
    },

    async getCustomers(): Promise<ListedPage<Customer>> {
        const [customersPage, receivablesPage] = await Promise.all([
            collectPages((cursor) => giabanClient.listCustomers({ cursor })),
            collectPages((cursor) => giabanClient.listReceivables({ cursor })),
        ]);
        const customersParsed = customersPage;
        const receivablesParsed = receivablesPage;
        const outstandingByCustomer = new Map<string, number>();
        for (const row of receivablesParsed.items) {
            const customerId = String(row.customerId || '');
            if (!customerId) continue;
            outstandingByCustomer.set(customerId, (outstandingByCustomer.get(customerId) || 0) + (Number(row.outstanding) || 0));
        }
        const truncated = customersParsed.truncated || receivablesParsed.truncated;
        return {
            items: customersParsed.items.map((row: any) => ({
                id: String(row.id),
                name: String(row.displayName || row.name || ''),
                phone: String(row.phoneMasked || row.phone || ''),
                address: '',
                revision: Number(row.revision) || 1,
                duplicatePhoneWarning: Boolean(row.duplicatePhoneWarning),
                outstanding: outstandingByCustomer.get(String(row.id)) || 0,
                outstandingComplete: !truncated,
                piiComplete: false,
            })),
            truncated,
        };
    },

    async deleteCustomer(customerId: string): Promise<ListedPage<Customer>> {
        await giabanClient.archiveCustomer(customerId, newIdempotencyKey());
        return this.getCustomers();
    },

    async updateCustomer(updatedCustomer: Customer): Promise<ListedPage<Customer>> {
        const detail = updatedCustomer.piiComplete
            ? updatedCustomer
            : await this.loadCustomer(updatedCustomer.id);
        await giabanClient.updateCustomer(updatedCustomer.id, toCustomerWrite({
            name: updatedCustomer.name || detail.name,
            phone: updatedCustomer.phone || detail.phone,
            address: updatedCustomer.address || detail.address,
        }), updatedCustomer.revision || detail.revision || 1, newIdempotencyKey());
        return this.getCustomers();
    },

    async getTransactions(): Promise<ListedPage<Transaction>> {
        const collected = await collectPages((cursor) => giabanClient.listCashTransactions({ cursor }));
        return listedFrom(collected, (row: any) => ({
            id: String(row.id),
            type: row.type === 'expense' ? 'expense' : 'income',
            amount: Number(row.amount) || 0,
            description: String(row.description || ''),
            date: String(row.date || ''),
            category: String(row.category || ''),
        }));
    },

    async addTransaction(transaction: Transaction): Promise<ListedPage<Transaction>> {
        await giabanClient.createCashTransaction(toCashTransactionWrite(transaction), newIdempotencyKey());
        return this.getTransactions();
    },

    async deleteTransaction(transactionId: string, reason: string): Promise<ListedPage<Transaction>> {
        const preview = await giabanClient.previewCashReversal(transactionId, reason);
        await giabanClient.confirmCashReversal(transactionId, String(preview.confirmationToken));
        return this.getTransactions();
    },

    async getReportSummary(fromDate: string, toDate: string): Promise<ReportSummary> {
        return mapReportSummary(await giabanClient.getReportSummary(fromDate, toDate));
    },

    async getBankInfo(): Promise<BankInfo> {
        const row = await giabanClient.getBankSettings();
        return {
            bankName: String(row.bankName || ''),
            accountNumber: String(row.accountNumber || ''),
            accountName: String(row.accountName || ''),
            qrCodeUrl: String(row.qrCodeUrl || ''),
            revision: Number(row.revision) || 1,
        };
    },

    async saveBankInfo(info: BankInfo, idempotencyKey = newIdempotencyKey()): Promise<BankInfo> {
        const expected = requireRevision(info.revision, 'Chưa tải được thông tin ngân hàng; không lưu với revision giả.');
        const saved = await giabanClient.updateBankSettings({
            bankName: info.bankName,
            accountNumber: info.accountNumber,
            accountName: info.accountName,
            qrCodeUrl: info.qrCodeUrl || '',
        }, expected, idempotencyKey);
        return {
            bankName: String(saved.bankName || ''),
            accountNumber: String(saved.accountNumber || ''),
            accountName: String(saved.accountName || ''),
            qrCodeUrl: String(saved.qrCodeUrl || ''),
            revision: Number(saved.revision) || 1,
        };
    },

    async getTaxRate(): Promise<{ rate: number; revision: number }> {
        const row = await giabanClient.getTaxSettings();
        const result = { rate: Number(row.rate) || 0, revision: Number(row.revision) || 1 };
        lastTaxRevision = result.revision;
        return result;
    },

    async saveTaxRate(rate: number, revision = lastTaxRevision, idempotencyKey = newIdempotencyKey()): Promise<{ rate: number; revision: number }> {
        const expected = requireRevision(revision, 'Chưa tải được thuế; không lưu với revision giả.');
        const saved = await giabanClient.updateTaxSettings({ rate }, expected, idempotencyKey);
        lastTaxRevision = Number(saved.revision) || expected + 1;
        return { rate: Number(saved.rate) || 0, revision: Number(saved.revision) || 1 };
    },

    async getShopTemplates(): Promise<ListedPage<ShopTemplate>> {
        const collected = await collectPages((cursor) => giabanClient.listShopTemplates({ cursor }));
        const listed = listedFrom(collected, (row: any) => ({
            id: String(row.id),
            name: String(row.name || ''),
            address: String(row.address || ''),
            phone: String(row.phone || ''),
            isDefault: Boolean(row.isDefault),
            archived: Boolean(row.archived),
            revision: Number(row.revision) || 1,
        }));
        return {
            ...listed,
            items: listed.items.filter((row) => !row.archived),
        };
    },

    async saveShopTemplate(template: ShopTemplate): Promise<ShopTemplate> {
        if (!template.id || template.id.startsWith('temp_')) {
            const created = await giabanClient.createShopTemplate(toShopTemplateWrite(template), newIdempotencyKey());
            return {
                id: String(created.id),
                name: String(created.name || ''),
                address: String(created.address || ''),
                phone: String(created.phone || ''),
                isDefault: Boolean(created.isDefault),
                revision: Number(created.revision) || 1,
            };
        }
        const saved = await giabanClient.updateShopTemplate(template.id, toShopTemplateWrite(template), template.revision || 1, newIdempotencyKey());
        return {
            id: String(saved.id),
            name: String(saved.name || ''),
            address: String(saved.address || ''),
            phone: String(saved.phone || ''),
            isDefault: Boolean(saved.isDefault),
            revision: Number(saved.revision) || 1,
        };
    },

    async archiveShopTemplate(id: string, revision?: number): Promise<ListedPage<ShopTemplate>> {
        await giabanClient.archiveShopTemplate(id, newIdempotencyKey(), revision);
        return this.getShopTemplates();
    },

    async setDefaultShopTemplate(id: string, revision: number): Promise<ListedPage<ShopTemplate>> {
        await giabanClient.setDefaultShopTemplate(id, revision, newIdempotencyKey());
        return this.getShopTemplates();
    },
};

export { CloudWriteError };
