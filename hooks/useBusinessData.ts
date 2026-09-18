import { businessDateOnly, businessYearStart } from '../server/domain/timezone.ts';
import { lineAmount } from '../server/domain/quantity.ts';

import { useState, useEffect, useRef } from 'react';
import {
    businessService,
    CloudWriteError,
    Customer,
    HistoricalReview,
    Order,
    ReportSummary,
    ShopTemplate,
    Transaction,
} from '../businessService';
import { storageService } from '../storageService';
import { Product } from '../types';
import { createSubmitLock, isRetryableError, stepKey } from '../utils/operationState';
import { BankInfo } from '../businessService';
import { SESSION_ENDED_EVENT } from '../apiService';
import {
    clearBusinessSessionCache,
    getBusinessSessionCache,
    setBusinessSessionCache,
    type BusinessSessionSnapshot,
} from '../client/businessSessionCache';

export type TabType = 'orders' | 'history' | 'customers' | 'profit' | 'reports';

export interface OrderItem {
    id: string;
    productId?: string | null;
    name: string;
    unit: string;
    quantity: number;
    soCuon?: number;
    soKi?: number;
    unitPrice: number;
    costPrice?: number;
    total: number;
    isManual?: boolean;
}

export interface NewOrder {
    customerId: string;
    customerName: string;
    phone: string;
    address: string;
    items: OrderItem[];
    shippingFee: number;
    discount: number;
    debt: number;
    collectAmount?: number;
    note: string;
    isManualEntry: boolean;
    showSoCuon: boolean;
    showSoKi: boolean;
    selectedTemplateId: string;
    totalAmountInWords: string;
    paymentMethod: 'cod' | 'banking';
    createNewCustomer: boolean;
    previousDebt?: number;
}

const emptyOrder = (templateId = 'default'): NewOrder => ({
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    items: [],
    shippingFee: 0,
    discount: 0,
    debt: 0,
    collectAmount: 0,
    note: '',
    isManualEntry: false,
    showSoCuon: false,
    showSoKi: false,
    selectedTemplateId: templateId,
    totalAmountInWords: '',
    paymentMethod: 'cod',
    createNewCustomer: false,
    previousDebt: 0,
});

export const useBusinessData = () => {
    const [activeTab, setActiveTab] = useState<TabType>('orders');
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersTruncated, setOrdersTruncated] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [customersTruncated, setCustomersTruncated] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [productsTruncated, setProductsTruncated] = useState(false);
    const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
    const [shopTemplates, setShopTemplates] = useState<ShopTemplate[]>([]);
    const [report, setReport] = useState<ReportSummary | null>(null);
    const [review, setReview] = useState<HistoricalReview | null>(null);
    const [loadError, setLoadError] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const submitLock = useRef(createSubmitLock());
    const createdCustomerIdRef = useRef('');

    const [newOrder, setNewOrder] = useState<NewOrder>(emptyOrder());
    const [customerMatches, setCustomerMatches] = useState<Customer[]>([]);
    const [orderSearch, setOrderSearch] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [addQuantity, setAddQuantity] = useState<number>(1);

    const productDropdownRef = useRef<HTMLDivElement>(null);

    const applySnapshot = (snapshot: BusinessSessionSnapshot) => {
        setOrders(snapshot.orders);
        setOrdersTruncated(snapshot.ordersTruncated);
        setCustomers(snapshot.customers);
        setCustomersTruncated(snapshot.customersTruncated);
        setTransactions(snapshot.transactions);
        setProducts(snapshot.products);
        setProductsTruncated(snapshot.productsTruncated);
        setBankInfo(snapshot.bankInfo);
        setShopTemplates(snapshot.shopTemplates);
        setReport(snapshot.report);
        setReview(snapshot.review);
        const defaultTemplate = snapshot.shopTemplates.find(t => t.isDefault) || snapshot.shopTemplates[0];
        if (defaultTemplate) {
            setNewOrder(prev => ({ ...prev, selectedTemplateId: defaultTemplate.id }));
        }
    };

    const loadData = async (force = false) => {
        if (!force) {
            const cached = getBusinessSessionCache();
            if (cached) {
                applySnapshot(cached);
                setLoadError('');
                setLoading(false);
                return;
            }
        }
        setLoading(true);
        setLoadError('');
        try {
            const today = new Date();
            const toDate = businessDateOnly(today);
            const fromDate = businessYearStart(today);
            const [ordersData, customersData, transactionsData, productsData, bankInfoData, shopTemplatesData, reportData, reviewData] = await Promise.all([
                businessService.getOrders(),
                businessService.getCustomers(),
                businessService.getTransactions(),
                storageService.getAdminProducts(),
                businessService.getBankInfo(),
                businessService.getShopTemplates(),
                businessService.getReportSummary(fromDate, toDate),
                businessService.getStatusReview(),
            ]);
            const snapshot: BusinessSessionSnapshot = {
                orders: ordersData.items,
                ordersTruncated: ordersData.truncated,
                customers: customersData.items,
                customersTruncated: customersData.truncated,
                transactions: transactionsData.items,
                products: productsData.products,
                productsTruncated: productsData.truncated,
                bankInfo: bankInfoData,
                shopTemplates: shopTemplatesData.items,
                report: reportData,
                review: reviewData,
            };
            setBusinessSessionCache(snapshot);
            applySnapshot(snapshot);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu kinh doanh.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    useEffect(() => {
        const onSessionEnded = () => clearBusinessSessionCache();
        window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
        return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    }, []);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const getSubtotal = (): number => {
        return newOrder.items.reduce((sum, item) => sum + item.total, 0);
    };

    const getTotal = (): number => {
        return getSubtotal() + (newOrder.shippingFee || 0) + (newOrder.debt || newOrder.previousDebt || 0) - (newOrder.discount || 0);
    };

    const addVariantToOrder = (product: Product, variant: import('../types').ProductVariant) => {
        const quantity = Number(addQuantity) >= 1 ? Number(addQuantity) : 1;
        const item: OrderItem = {
            id: 'item_' + Date.now(),
            productId: product.id,
            name: product.name + (variant.size ? ` - ${variant.size}` : ''),
            unit: variant.unit,
            quantity,
            unitPrice: variant.price,
            costPrice: variant.costPrice || 0,
            total: variant.price * quantity
        };
        setNewOrder({
            ...newOrder,
            items: [...newOrder.items, item]
        });
        setProductSearch('');
        setShowProductDropdown(false);
        setAddQuantity(1);
    };

    const addProductFromList = (product: Product) => {
        if (product.variants.length === 1) {
            addVariantToOrder(product, product.variants[0]);
        }
    };

    const calculateItemTotal = (item: OrderItem): number => {
        try {
            return lineAmount(Number(item.unitPrice) || 0, {
                quantity: Number(item.quantity) || 0,
                soCuon: item.soCuon,
                soKi: item.soKi,
            });
        } catch {
            return 0;
        }
    };

    const updateItemField = (itemId: string, field: keyof OrderItem, value: string | number) => {
        setNewOrder({
            ...newOrder,
            items: newOrder.items.map(item => {
                if (item.id === itemId) {
                    const updated = { ...item, [field]: value };
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
        if (submitLock.current.key) {
            alert('Đơn đang chờ xác định kết quả. Thử lại nguyên nội dung đã gửi trước khi tạo đơn mới.');
            return;
        }
        const defaultTemplate = shopTemplates.find(t => t.isDefault) || shopTemplates[0];
        setNewOrder(emptyOrder(defaultTemplate?.id || 'default'));
        setCustomerMatches([]);
    };

    const searchExistingCustomers = async (query: string) => {
        if (!query.trim()) {
            setCustomerMatches([]);
            return;
        }
        const q = query.trim().toLowerCase();
        const localMatches = customers.filter(c =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        );
        setCustomerMatches(localMatches);

        try {
            const result = await businessService.searchCustomers(query.trim());
            const enriched = result.items.map(item => {
                const found = customers.find(c => c.id === item.id);
                return found && found.outstanding !== undefined
                    ? { ...item, outstanding: found.outstanding }
                    : item;
            });
            setCustomerMatches(enriched.length > 0 ? enriched : localMatches);
        } catch {
            // Keep local matches if backend search fails
        }
    };

    const selectCustomer = async (customerId: string) => {
        const existing = customers.find(c => c.id === customerId);
        const debtVal = existing?.outstanding || 0;
        setNewOrder(prev => ({
            ...prev,
            customerId: customerId,
            customerName: existing?.name || prev.customerName,
            phone: existing?.phone || prev.phone,
            address: existing?.address || prev.address,
            debt: debtVal,
            previousDebt: debtVal,
            createNewCustomer: false,
        }));
        setCustomerMatches([]);

        try {
            const detail = await businessService.loadCustomer(customerId);
            if (detail) {
                setNewOrder(prev => (prev.customerId === customerId ? {
                    ...prev,
                    customerName: detail.name || prev.customerName,
                    phone: detail.phone || prev.phone,
                    address: detail.address || prev.address,
                } : prev));
            }
        } catch {
            // Silently retain existing customer data in state
        }
    };

    const handleSaveOrder = async (confirm: boolean): Promise<Order | null> => {
        if (submitLock.current.inFlight) return null;
        if (!newOrder.customerName.trim() || !newOrder.phone.trim() || !newOrder.address.trim()) {
            alert('Vui lòng nhập đủ tên, số điện thoại và địa chỉ.');
            return null;
        }
        if (newOrder.items.length === 0) {
            alert('Vui lòng thêm ít nhất 1 sản phẩm');
            return null;
        }
        const key = submitLock.current.begin();
        if (!key) return null;
        setSaving(true);
        try {
            let customerId = newOrder.customerId || createdCustomerIdRef.current;
            if (!customerId) {
                const phoneTrimmed = newOrder.phone.trim();
                const matchedByPhone = customers.find(c => c.phone && c.phone.trim() === phoneTrimmed);
                if (matchedByPhone) {
                    customerId = String(matchedByPhone.id);
                } else {
                    const created = await businessService.createCustomer({
                        name: newOrder.customerName.trim(),
                        phone: phoneTrimmed,
                        address: newOrder.address.trim(),
                    }, stepKey(key, "customer"));
                    customerId = String(created.id);
                    createdCustomerIdRef.current = customerId;
                }
            }
            const total = getTotal();
            const collectAmount = Math.min(Math.max(0, Number(newOrder.collectAmount) || 0), total);
            const saved = await businessService.placeOrder({
                customerId,
                customerName: newOrder.customerName,
                phone: newOrder.phone,
                address: newOrder.address,
                items: newOrder.items,
                shippingFee: newOrder.shippingFee || 0,
                discount: newOrder.discount || 0,
                note: newOrder.note,
                shopTemplateId: newOrder.selectedTemplateId,
                collectAmount: confirm ? collectAmount : 0,
                confirm,
                paymentMethod: newOrder.paymentMethod,
                totalAmountInWords: newOrder.totalAmountInWords,
                idempotencyKey: key,
            });
            submitLock.current.succeed();
            createdCustomerIdRef.current = '';
            setOrders(prev => [saved, ...prev.filter(o => o.id !== saved.id)]);
            void loadData(true);
            resetOrderForm();
            return saved;
        } catch (error) {
            if (isRetryableError(error) || (error instanceof CloudWriteError && (error.retryable || error.code === 'IDEMPOTENCY_CONFLICT'))) {
                submitLock.current.failRetryable();
            } else {
                submitLock.current.failTerminal();
            }
            alert(error instanceof Error ? error.message : 'Không lưu được đơn lên máy chủ.');
            return null;
        } finally {
            setSaving(false);
        }
    };

    return {
        activeTab, setActiveTab,
        orders, setOrders,
        ordersTruncated,
        customers, setCustomers,
        customersTruncated,
        transactions,
        bankInfo, setBankInfo,
        shopTemplates, setShopTemplates,
        report,
        review,
        loading,
        loadError,
        saving,
        newOrder, setNewOrder,
        customerMatches,
        searchExistingCustomers,
        selectCustomer,
        orderSearch, setOrderSearch,
        customerSearch, setCustomerSearch,
        productSearch, setProductSearch,
        showProductDropdown, setShowProductDropdown,
        addQuantity, setAddQuantity,
        productDropdownRef,
        filteredProducts,
        productsTruncated,
        getSubtotal, getTotal,
        addProductFromList, addVariantToOrder, updateItemField, removeItem,
        handleSaveOrder,
        resetOrderForm,
        reload: () => loadData(true),
    };
};
