import { useState, useEffect, useRef } from 'react';
import { businessService, Order, Customer, Transaction, BankInfo, ShopTemplate } from '../businessService';
import { storageService } from '../storageService';
import { Product } from '../types';

export type TabType = 'orders' | 'history' | 'customers' | 'profit' | 'reports';

export interface OrderItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    soCuon?: number;  // Number of rolls
    soKi?: number;    // Weight in kg
    unitPrice: number;
    costPrice?: number;
    total: number;
    isManual?: boolean; // Flag for manually entered items
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
    showSoCuon: boolean;     // Toggle column visibility
    showSoKi: boolean;       // Toggle column visibility
    selectedTemplateId: string; // New field
    totalAmountInWords: string;
}

export const useBusinessData = () => {
    const [activeTab, setActiveTab] = useState<TabType>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const [shopTemplates, setShopTemplates] = useState<ShopTemplate[]>([]);

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
        isManualEntry: false,
        showSoCuon: false,
        showSoKi: false,
        selectedTemplateId: 'default',
        totalAmountInWords: ''
    });

    const [orderSearch, setOrderSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [addQuantity, setAddQuantity] = useState<number | ''>('');

    const productDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [ordersData, customersData, transactionsData, productsData, bankInfoData, shopTemplatesData] = await Promise.all([
            businessService.getOrders(),
            businessService.getCustomers(),
            businessService.getTransactions(),
            storageService.getProducts(),
            businessService.getBankInfo(),
            businessService.getShopTemplates()
        ]);
        setOrders(ordersData);
        setCustomers(customersData);
        setTransactions(transactionsData);
        setProducts(productsData);
        setBankInfo(bankInfoData);
        setShopTemplates(shopTemplatesData);

        // Set initial selected template to default
        const defaultTemplate = shopTemplatesData.find(t => t.isDefault) || shopTemplatesData[0];
        if (defaultTemplate) {
            setNewOrder(prev => ({ ...prev, selectedTemplateId: defaultTemplate.id }));
        }
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

    const addVariantToOrder = (product: Product, variant: import('../types').ProductVariant) => {
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
        setAddQuantity('');
    };

    const addProductFromList = (product: Product) => {
        if (product.variants.length === 1) {
            addVariantToOrder(product, product.variants[0]);
        }
        // If multiple variants, the UI should handle showing them
    };

    // Calculate total based on automatic logic
    const calculateItemTotal = (item: OrderItem): number => {
        const quantity = Number(item.quantity) || 0;
        const soCuon = Number(item.soCuon) || 0;
        const soKi = Number(item.soKi) || 0;
        const unitPrice = Number(item.unitPrice) || 0;

        // Automatic formula detection:
        // 1. If both Cuon and Ki > 0: SL * Cuon * Ki * Price
        // 2. If only Cuon > 0: SL * Cuon * Price
        // 3. If only Ki > 0: SL * Ki * Price
        // 4. Default: SL * Price

        if (soCuon > 0 && soKi > 0) {
            return quantity * soCuon * soKi * unitPrice;
        } else if (soCuon > 0) {
            return quantity * soCuon * unitPrice;
        } else if (soKi > 0) {
            return quantity * soKi * unitPrice;
        } else {
            return quantity * unitPrice;
        }
    };

    const updateItemField = (itemId: string, field: keyof OrderItem, value: string | number) => {
        setNewOrder({
            ...newOrder,
            items: newOrder.items.map(item => {
                if (item.id === itemId) {
                    const updated = { ...item, [field]: value };
                    // Recalculate total when any calculation-related field changes
                    if (field === 'quantity' || field === 'unitPrice' || field === 'soCuon' || field === 'soKi') {
                        updated.total = calculateItemTotal(updated);
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
        // Get current default template
        const defaultTemplate = shopTemplates.find(t => t.isDefault) || shopTemplates[0];

        setNewOrder({
            customerName: '',
            phone: '',
            address: '',
            items: [],
            shippingFee: 0,
            discount: 0,
            debt: 0,
            note: '',
            isManualEntry: false,
            showSoCuon: false,
            showSoKi: false,
            selectedTemplateId: defaultTemplate?.id || 'default',
            totalAmountInWords: ''
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
            debt: newOrder.debt,
            paymentStatus: (newOrder.debt || 0) > 0 ? 'unpaid' : 'paid',
            totalAmountInWords: newOrder.totalAmountInWords,
            shopTemplateId: newOrder.selectedTemplateId
        };

        const updatedOrders = await businessService.addOrder(order);
        setOrders(updatedOrders);
        await updateCustomer(order);
        resetOrderForm();
        return order;
    };

    return {
        activeTab, setActiveTab,
        orders, setOrders,
        customers, setCustomers,
        transactions,
        bankInfo, setBankInfo,
        shopTemplates, setShopTemplates,
        newOrder, setNewOrder,
        orderSearch, setOrderSearch,
        customerSearch, setCustomerSearch,
        productSearch, setProductSearch,
        showProductDropdown, setShowProductDropdown,
        addQuantity, setAddQuantity,
        productDropdownRef,
        filteredProducts,
        getSubtotal, getTotal,
        addProductFromList, addVariantToOrder, updateItemField, removeItem,
        handleSaveOrder,
        resetOrderForm, updateCustomer
    };
};
