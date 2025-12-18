import { apiService } from './apiService';

export interface Order {
    id: string;
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
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    address: string;
    totalSpent: number;
    lastOrderDate: string;
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
}

export const businessService = {
    // Orders
    async getOrders(): Promise<Order[]> {
        const data = await apiService.get<Order[]>('orders');
        return data || [];
    },

    async saveOrders(orders: Order[]): Promise<boolean> {
        return await apiService.save('orders', orders);
    },

    async addOrder(order: Order): Promise<Order[]> {
        const orders = await this.getOrders();
        const newOrders = [order, ...orders];
        await this.saveOrders(newOrders);
        return newOrders;
    },

    async updateOrder(updatedOrder: Order): Promise<Order[]> {
        const orders = await this.getOrders();
        const newOrders = orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        await this.saveOrders(newOrders);
        return newOrders;
    },

    // Customers
    async getCustomers(): Promise<Customer[]> {
        const data = await apiService.get<Customer[]>('customers');
        return data || [];
    },

    async saveCustomers(customers: Customer[]): Promise<boolean> {
        return await apiService.save('customers', customers);
    },

    // Cost Prices
    async getCostPrices(): Promise<CostPrice[]> {
        const data = await apiService.get<CostPrice[]>('costPrices');
        return data || [];
    },

    async saveCostPrices(costPrices: CostPrice[]): Promise<boolean> {
        return await apiService.save('costPrices', costPrices);
    },

    // Transactions
    async getTransactions(): Promise<Transaction[]> {
        const data = await apiService.get<Transaction[]>('transactions');
        return data || [];
    },

    async saveTransactions(transactions: Transaction[]): Promise<boolean> {
        return await apiService.save('transactions', transactions);
    },

    // Bank Info
    async getBankInfo(): Promise<BankInfo | null> {
        return await apiService.get<BankInfo>('bankInfo');
    },

    async saveBankInfo(info: BankInfo): Promise<boolean> {
        return await apiService.save('bankInfo', info);
    },

    // Tax Rate
    async getTaxRate(): Promise<number> {
        const data = await apiService.get<{ rate: number }>('taxRate');
        return data?.rate || 0;
    },

    async saveTaxRate(rate: number): Promise<boolean> {
        return await apiService.save('taxRate', { rate });
    }
};
