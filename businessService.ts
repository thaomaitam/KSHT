import { giabanClient, newIdempotencyKey, CloudWriteError } from './client/giabanClient';

export interface Order {
    id: string;
    customerId?: string;
    customerName: string;
    phone: string;
    address: string;
    items: any[];
    total: number;
    status: 'pending' | 'shipping' | 'completed' | 'cancelled';
    createdAt: string;
    paymentMethod: 'cod' | 'banking';
    note?: string;
    shippingFee?: number;
    discount?: number;
    debt?: number;
    paymentStatus?: 'paid' | 'unpaid';
    totalAmountInWords?: string;
    shopTemplateId?: string;
    revision?: number;
    domainStatus?: string;
    netCollected?: number;
    outstanding?: number;
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    address: string;
    totalSpent: number;
    lastOrderDate: string;
    orderCount?: number;
    debt?: number;
    revision?: number;
}

export interface CostPrice {
    productId: string;
    price: number;
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
    revision?: number;
}

const mapUiStatus = (status: string): Order['status'] => {
    if (status === 'shipping') return 'shipping';
    if (status === 'completed') return 'completed';
    if (status === 'cancelled' || status === 'discarded') return 'cancelled';
    return 'pending';
};

const toOrder = (row: any): Order => {
    const contact = row.contact || {};
    const outstanding = Number(row.outstanding) || 0;
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
        status: mapUiStatus(String(row.status || 'confirmed')),
        createdAt: String(row.createdAt || ''),
        paymentMethod: row.paymentMethod === 'banking' ? 'banking' : 'cod',
        note: row.note ? String(row.note) : '',
        shippingFee: Number(row.shippingFee) || 0,
        discount: Number(row.discount) || 0,
        debt: outstanding,
        paymentStatus: outstanding > 0 ? 'unpaid' : 'paid',
        shopTemplateId: row.shopTemplateId ? String(row.shopTemplateId) : undefined,
        revision: Number(row.revision) || 1,
        domainStatus: String(row.status || ''),
        netCollected: Number(row.netCollected) || 0,
        outstanding,
    };
};

const toCustomer = (row: any, debt = 0): Customer => ({
    id: String(row.id),
    name: String(row.name || row.displayName || ''),
    phone: String(row.phone || row.phoneMasked || ''),
    address: String(row.address || ''),
    totalSpent: Number(row.totalSpent) || 0,
    lastOrderDate: String(row.lastOrderDate || ''),
    orderCount: Number(row.orderCount) || 0,
    debt,
    revision: Number(row.revision) || 1,
});

const loadInvoices = async (ids: string[]): Promise<Order[]> => {
    const orders: Order[] = [];
    for (const id of ids) {
        try {
            orders.push(toOrder(await giabanClient.getOrderInvoice(id)));
        } catch {
            try {
                orders.push(toOrder(await giabanClient.getOrder(id)));
            } catch {
                // skip discarded/missing
            }
        }
    }
    return orders.filter((order) => order.domainStatus !== 'discarded');
};

export const businessService = {
    async getOrders(): Promise<Order[]> {
        const listed = giabanClient.itemsOf(await giabanClient.listOrders());
        return loadInvoices(listed.map((row: any) => String(row.id)));
    },

    async addOrder(order: Order): Promise<Order[]> {
        await this.placeOrder({
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            items: order.items,
            shippingFee: order.shippingFee || 0,
            discount: order.discount || 0,
            note: order.note || '',
            shopTemplateId: order.shopTemplateId,
            collectAmount: Math.max(0, (order.total || 0) - (order.debt || 0)),
        });
        return this.getOrders();
    },

    async placeOrder(input: {
        customerName: string;
        phone: string;
        address: string;
        items: any[];
        shippingFee: number;
        discount: number;
        note: string;
        shopTemplateId?: string;
        collectAmount: number;
    }): Promise<Order> {
        const listed = giabanClient.itemsOf(await giabanClient.listCustomers(input.phone || input.customerName));
        let customerId = listed.length === 1 ? String(listed[0].id) : '';
        if (!customerId) {
            const created = await giabanClient.createCustomer({
                name: input.customerName,
                phone: input.phone,
                address: input.address,
            }, newIdempotencyKey());
            customerId = String(created.id);
        }
        const draft = await giabanClient.createDraftOrder({
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
        }, newIdempotencyKey());
        const confirmed = await giabanClient.confirmOrder(String(draft.id), Number(draft.revision) || 1, newIdempotencyKey());
        if (input.collectAmount > 0) {
            await giabanClient.recordPayment(String(confirmed.id), {
                amount: input.collectAmount,
                method: 'cash',
            }, newIdempotencyKey());
        }
        return toOrder(await giabanClient.getOrderInvoice(String(confirmed.id)));
    },

    async updateOrder(updatedOrder: Order): Promise<Order[]> {
        const current = updatedOrder.domainStatus || 'confirmed';
        const target = updatedOrder.status;
        if (target === 'shipping' && current !== 'shipping') {
            await giabanClient.markOrderShipping(updatedOrder.id, updatedOrder.revision || 1, newIdempotencyKey());
        } else if (target === 'completed' && current !== 'completed') {
            await giabanClient.completeOrder(updatedOrder.id, updatedOrder.revision || 1, newIdempotencyKey());
        }
        return this.getOrders();
    },

    async deleteOrder(orderId: string): Promise<Order[]> {
        const listed = giabanClient.itemsOf(await giabanClient.listOrders()).find((row: any) => row.id === orderId);
        const status = String(listed?.status || '');
        if (status === 'draft') {
            await giabanClient.discardDraftOrder(orderId, Number(listed?.revision) || 1, newIdempotencyKey());
            return this.getOrders();
        }
        const preview = await giabanClient.previewOrderCancellation(orderId, 'Xóa đơn từ giao diện admin');
        if (Array.isArray(preview.blockers) && preview.blockers.length > 0) {
            throw new CloudWriteError(preview.blockers.join('; '), { code: 'INVALID_TRANSITION' });
        }
        await giabanClient.confirmOrderCancellation(orderId, String(preview.confirmationToken));
        return this.getOrders();
    },

    async markOrderPaid(order: Order): Promise<Order[]> {
        const amount = Number(order.outstanding ?? order.debt) || 0;
        if (amount > 0) {
            await giabanClient.recordPayment(order.id, { amount, method: 'cash' }, newIdempotencyKey());
        }
        return this.getOrders();
    },

    async markOrderUnpaid(order: Order): Promise<Order[]> {
        const payments = giabanClient.itemsOf(await giabanClient.listPayments(order.id));
        for (const payment of payments) {
            const remaining = Number(payment.remaining ?? payment.amount) || 0;
            if (remaining <= 0) continue;
            const preview = await giabanClient.previewPaymentRefund(String(payment.id), remaining, 'Đánh dấu chưa thanh toán');
            await giabanClient.confirmPaymentRefund(String(payment.id), String(preview.confirmationToken));
        }
        return this.getOrders();
    },

    async getCustomers(): Promise<Customer[]> {
        const [customersPage, receivablesPage, orders] = await Promise.all([
            giabanClient.listCustomers(),
            giabanClient.listReceivables(),
            this.getOrders(),
        ]);
        const debtByCustomer = new Map<string, number>();
        for (const row of giabanClient.itemsOf(receivablesPage)) {
            const customerId = String(row.customerId || '');
            debtByCustomer.set(customerId, (debtByCustomer.get(customerId) || 0) + (Number(row.outstanding) || 0));
        }
        const spentByCustomer = new Map<string, { total: number; last: string; count: number }>();
        for (const order of orders) {
            if (!order.customerId || order.status === 'cancelled') continue;
            const current = spentByCustomer.get(order.customerId) || { total: 0, last: '', count: 0 };
            current.total += order.total;
            current.count += 1;
            if (order.createdAt > current.last) current.last = order.createdAt;
            spentByCustomer.set(order.customerId, current);
        }
        return giabanClient.itemsOf(customersPage).map((row: any) => {
            const customer = toCustomer(row, debtByCustomer.get(String(row.id)) || 0);
            const spent = spentByCustomer.get(customer.id);
            return spent
                ? { ...customer, totalSpent: spent.total, lastOrderDate: spent.last, orderCount: spent.count }
                : customer;
        });
    },

    async deleteCustomer(customerId: string): Promise<Customer[]> {
        await giabanClient.archiveCustomer(customerId, newIdempotencyKey());
        return this.getCustomers();
    },

    async updateCustomer(updatedCustomer: Customer): Promise<Customer[]> {
        await giabanClient.updateCustomer(updatedCustomer.id, {
            name: updatedCustomer.name,
            phone: updatedCustomer.phone,
            address: updatedCustomer.address,
        }, updatedCustomer.revision || 1, newIdempotencyKey());
        return this.getCustomers();
    },

    async getCostPrices(): Promise<CostPrice[]> {
        return [];
    },

    async getTransactions(): Promise<Transaction[]> {
        return giabanClient.itemsOf(await giabanClient.listCashTransactions()).map((row: any) => ({
            id: String(row.id),
            type: row.type === 'expense' ? 'expense' : 'income',
            amount: Number(row.amount) || 0,
            description: String(row.description || ''),
            date: String(row.date || ''),
            category: String(row.category || ''),
        }));
    },

    async addTransaction(transaction: Transaction): Promise<Transaction[]> {
        await giabanClient.createCashTransaction({
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            category: transaction.category,
            date: transaction.date,
        }, newIdempotencyKey());
        return this.getTransactions();
    },

    async deleteTransaction(transactionId: string): Promise<Transaction[]> {
        const preview = await giabanClient.previewCashReversal(transactionId);
        await giabanClient.confirmCashReversal(transactionId, String(preview.confirmationToken));
        return this.getTransactions();
    },

    async getBankInfo(): Promise<BankInfo | null> {
        try {
            const row = await giabanClient.getBankSettings();
            return {
                bankName: String(row.bankName || ''),
                accountNumber: String(row.accountNumber || ''),
                accountName: String(row.accountName || ''),
                qrCodeUrl: String(row.qrCodeUrl || ''),
                revision: Number(row.revision) || 1,
            };
        } catch {
            return null;
        }
    },

    async saveBankInfo(info: BankInfo): Promise<boolean> {
        const current = await this.getBankInfo();
        await giabanClient.updateBankSettings({
            bankName: info.bankName,
            accountNumber: info.accountNumber,
            accountName: info.accountName,
            qrCodeUrl: info.qrCodeUrl || '',
        }, current?.revision || 1, newIdempotencyKey());
        return true;
    },

    async getTaxRate(): Promise<number> {
        try {
            const row = await giabanClient.getTaxSettings();
            return Number(row.rate) || 0;
        } catch {
            return 0;
        }
    },

    async saveTaxRate(rate: number): Promise<boolean> {
        const current = await giabanClient.getTaxSettings();
        await giabanClient.updateTaxSettings({ rate }, Number(current.revision) || 1, newIdempotencyKey());
        return true;
    },

    async getShopTemplates(): Promise<ShopTemplate[]> {
        return giabanClient.itemsOf(await giabanClient.listShopTemplates())
            .filter((row: any) => !row.archived)
            .map((row: any) => ({
                id: String(row.id),
                name: String(row.name || ''),
                address: String(row.address || ''),
                phone: String(row.phone || ''),
                isDefault: Boolean(row.isDefault),
                revision: Number(row.revision) || 1,
            }));
    },

    async saveShopTemplates(templates: ShopTemplate[]): Promise<boolean> {
        const existing = await this.getShopTemplates();
        const existingIds = new Set(existing.map((template) => template.id));
        for (const template of templates) {
            if (!existingIds.has(template.id)) {
                const created = await giabanClient.createShopTemplate({
                    name: template.name,
                    address: template.address,
                    phone: template.phone,
                    isDefault: Boolean(template.isDefault),
                }, newIdempotencyKey());
                template.id = String(created.id);
                template.revision = Number(created.revision) || 1;
            } else {
                await giabanClient.updateShopTemplate(template.id, {
                    name: template.name,
                    address: template.address,
                    phone: template.phone,
                }, template.revision || 1, newIdempotencyKey());
            }
        }
        for (const previous of existing) {
            if (!templates.some((template) => template.id === previous.id)) {
                await giabanClient.archiveShopTemplate(previous.id, newIdempotencyKey());
            }
        }
        const defaultTemplate = templates.find((template) => template.isDefault) || templates[0];
        if (defaultTemplate) {
            const latest = (await this.getShopTemplates()).find((template) => template.id === defaultTemplate.id);
            await giabanClient.setDefaultShopTemplate(defaultTemplate.id, latest?.revision || 1, newIdempotencyKey());
        }
        return true;
    },
};
