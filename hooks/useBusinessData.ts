import { useState, useEffect, useRef } from 'react';
import { businessService, Order, Customer, Transaction, CostPrice, BankInfo } from '../businessService';
import { storageService } from '../storageService';
import { settingsService, CategoryItem } from '../settingsService';
import { Product } from '../types';

export type TabType = 'orders' | 'history' | 'customers' | 'transactions' | 'reports' | 'costPrices';

export interface OrderItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
    total: number;
}

export interface NewOrder {
    customerName: string;
    phone: string;
    address: string;
    items: OrderItem[];
    shippingFee: number;
    discount: number;
    debt: number;
    note: string;
    isManualEntry: boolean;
}

export const useBusinessData = () => {
    const [activeTab, setActiveTab] = useState<TabType>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [costPrices, setCostPrices] = useState<CostPrice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);

    // Order form state
    const [newOrder, setNewOrder] = useState<NewOrder>({
        customerName: '',
        phone: '',
        address: '',
        items: [],
        shippingFee: 0,
        discount: 0,
        debt: 0,
        note: '',
        isManualEntry: false
    });

    // Search and filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [orderSearch, setOrderSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [transactionSearch, setTransactionSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [addQuantity, setAddQuantity] = useState(1);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // Transaction state
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [newTransaction, setNewTransaction] = useState({
        type: 'income' as 'income' | 'expense',
        amount: 0,
        description: '',
        category: 'Bán hàng'
    });

    // Cost prices state as a record for easier access
    const [costPricesRecord, setCostPricesRecord] = useState<Record<string, number>>({});

    const productDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [ordersData, customersData, transactionsData, costPricesData, productsData, bankInfoData, categoriesData] = await Promise.all([
            businessService.getOrders(),
            businessService.getCustomers(),
            businessService.getTransactions(),
            businessService.getCostPrices(),
            storageService.getProducts(),
            businessService.getBankInfo(),
            settingsService.getCategories()
        ]);
        setOrders(ordersData);
        setCustomers(customersData);
        setTransactions(transactionsData);
        setProducts(productsData);
        setBankInfo(bankInfoData);
        setCategories(categoriesData);

        // Convert cost prices array to record
        const record: Record<string, number> = {};
        costPricesData.forEach(cp => {
            record[cp.productId] = cp.price;
        });
        setCostPricesRecord(record);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const getSubtotal = (): number => {
        return newOrder.items.reduce((sum, item) => sum + item.total, 0);
    };

    const getTotal = (): number => {
        return getSubtotal() + (newOrder.shippingFee || 0) + (newOrder.debt || 0) - (newOrder.discount || 0);
    };

    const addProductFromList = (product: Product) => {
        const variant = product.variants[0];
        const item: OrderItem = {
            id: 'item_' + Date.now(),
            name: product.name + (variant.size ? ` - ${variant.size}` : ''),
            unit: variant.unit,
            quantity: addQuantity,
            unitPrice: variant.price,
            costPrice: variant.costPrice || 0,
            total: variant.price * addQuantity
        };
        setNewOrder({
            ...newOrder,
            items: [...newOrder.items, item]
        });
        setProductSearch('');
        setShowProductDropdown(false);
        setAddQuantity(1);
    };

    const updateItemField = (itemId: string, field: keyof OrderItem, value: string | number) => {
        setNewOrder({
            ...newOrder,
            items: newOrder.items.map(item => {
                if (item.id === itemId) {
                    const updated = { ...item, [field]: value };
                    if (field === 'quantity' || field === 'unitPrice') {
                        updated.total = (Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0);
                    }
                    return updated;
                }
                return item;
            })
        });
    };

    const removeItem = (itemId: string) => {
        setNewOrder({
            ...newOrder,
            items: newOrder.items.filter(item => item.id !== itemId)
        });
    };

    const resetOrderForm = () => {
        setNewOrder({
            customerName: '',
            phone: '',
            address: '',
            items: [],
            shippingFee: 0,
            discount: 0,
            debt: 0,
            note: '',
            isManualEntry: false
        });
    };

    const updateCustomer = async (order: Order) => {
        const existingCustomer = customers.find(c => c.phone === order.phone || c.name === order.customerName);

        if (existingCustomer) {
            const updated: Customer = {
                ...existingCustomer,
                totalSpent: existingCustomer.totalSpent + order.total,
                lastOrderDate: order.createdAt,
                debt: (existingCustomer.debt || 0) + (order.debt || 0)
            };
            const newCustomers = customers.map(c => c.id === existingCustomer.id ? updated : c);
            await businessService.saveCustomers(newCustomers);
            setCustomers(newCustomers);
        } else {
            const newCustomer: Customer = {
                id: 'customer_' + Date.now(),
                name: order.customerName,
                phone: order.phone,
                address: order.address,
                totalSpent: order.total,
                lastOrderDate: order.createdAt,
                orderCount: 1,
                debt: order.debt || 0
            };
            const newCustomers = [newCustomer, ...customers];
            await businessService.saveCustomers(newCustomers);
            setCustomers(newCustomers);
        }
    };

    const handleSaveOrder = async (): Promise<Order | null> => {
        if (!newOrder.customerName.trim()) {
            alert('Vui lòng nhập tên khách hàng');
            return null;
        }
        if (newOrder.items.length === 0) {
            alert('Vui lòng thêm ít nhất 1 sản phẩm');
            return null;
        }

        const order: Order = {
            id: 'order_' + Date.now(),
            customerName: newOrder.customerName,
            phone: newOrder.phone,
            address: newOrder.address,
            items: newOrder.items,
            total: getTotal(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            paymentMethod: 'cod',
            note: newOrder.note,
            shippingFee: newOrder.shippingFee,
            discount: newOrder.discount,
            debt: newOrder.debt
        };

        const updatedOrders = await businessService.addOrder(order);
        setOrders(updatedOrders);
        await updateCustomer(order);
        resetOrderForm();
        return order;
    };

    const handleAddTransaction = async () => {
        if (newTransaction.amount <= 0 || !newTransaction.description) {
            alert('Vui lòng nhập đầy đủ thông tin giao dịch');
            return;
        }

        const transaction: Transaction = {
            id: 'trans_' + Date.now(),
            date: new Date().toISOString(),
            ...newTransaction
        };

        const updated = await businessService.addTransaction(transaction);
        setTransactions(updated);
        setShowTransactionModal(false);
        setNewTransaction({
            type: 'income',
            amount: 0,
            description: '',
            category: 'Bán hàng'
        });
    };

    const handleSaveCostPrices = async () => {
        const costPricesArray: CostPrice[] = Object.entries(costPricesRecord).map(([productId, price]) => ({
            productId,
            price: Number(price)
        }));
        await businessService.saveCostPrices(costPricesArray);
        alert('Đã lưu giá vốn thành công');
    };

    return {
        activeTab, setActiveTab,
        orders, setOrders,
        customers, setCustomers,
        transactions, setTransactions,
        costPrices: costPricesRecord, setCostPrices: setCostPricesRecord,
        products, setProducts,
        categories, setCategories,
        bankInfo, setBankInfo,
        newOrder, setNewOrder,
        searchTerm, setSearchTerm,
        orderSearch, setOrderSearch,
        customerSearch, setCustomerSearch,
        transactionSearch, setTransactionSearch,
        dateFrom, setDateFrom,
        dateTo, setDateTo,
        productSearch, setProductSearch,
        showProductDropdown, setShowProductDropdown,
        addQuantity, setAddQuantity,
        editingCustomer, setEditingCustomer,
        showTransactionModal, setShowTransactionModal,
        newTransaction, setNewTransaction,
        productDropdownRef,
        filteredProducts,
        getSubtotal, getTotal,
        addProductFromList, updateItemField, removeItem,
        handleSaveOrder,
        resetOrderForm, updateCustomer,
        handleAddTransaction,
        handleSaveCostPrices
    };
};
