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
    collectAmount: number;
    note: string;
    isManualEntry: boolean;
    showSoCuon: boolean;
    showSoKi: boolean;
    selectedTemplateId: string;
    totalAmountInWords: string;
    paymentMethod: 'cod' | 'banking';
    createNewCustomer: boolean;
}

const emptyOrder = (templateId = 'default'): NewOrder => ({
    customerId: '',
    customerName: '',
    phone: '',
    address: '',
    items: [],
    shippingFee: 0,
    discount: 0,
    collectAmount: 0,
    note: '',
    isManualEntry: false,
    showSoCuon: false,
    showSoKi: false,
    selectedTemplateId: templateId,
    totalAmountInWords: '',
    paymentMethod: 'cod',
    createNewCustomer: false,
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

    const loadData = async () => {
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
            setOrders(ordersData.items);
            setOrdersTruncated(ordersData.truncated);
            setCustomers(customersData.items);
            setCustomersTruncated(customersData.truncated);
            setTransactions(transactionsData.items);
            setProducts(productsData.products);
            setProductsTruncated(productsData.truncated);
            setBankInfo(bankInfoData);
            setShopTemplates(shopTemplatesData.items);
            setReport(reportData);
            setReview(reviewData);
            const defaultTemplate = shopTemplatesData.items.find(t => t.isDefault) || shopTemplatesData.items[0];
            if (defaultTemplate) {
                setNewOrder(prev => ({ ...prev, selectedTemplateId: defaultTemplate.id }));
            }
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Không tải được dữ liệu kinh doanh.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );

    const getSubtotal = (): number => {
        return newOrder.items.reduce((sum, item) => sum + item.total, 0);
    };

    const getTotal = (): number => {
        return getSubtotal() + (newOrder.shippingFee || 0) - (newOrder.discount || 0);
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
        try {
            const result = await businessService.searchCustomers(query.trim());
            setCustomerMatches(result.items);
        } catch {
            setCustomerMatches([]);
        }
    };

    const selectCustomer = async (customerId: string) => {
        const detail = await businessService.loadCustomer(customerId);
        setNewOrder({
            ...newOrder,
            customerId: detail.id,
            customerName: detail.name,
            phone: detail.phone,
            address: detail.address,
            createNewCustomer: false,
        });
        setCustomerMatches([]);
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
            if (newOrder.createNewCustomer || !customerId) {
                if (!newOrder.createNewCustomer) {
                    throw new Error('Chọn khách hàng hiện có hoặc bật "Tạo khách hàng mới". Không tự khớp.');
                }
                if (!customerId) {
                    const created = await businessService.createCustomer({
                        name: newOrder.customerName,
                        phone: newOrder.phone,
                        address: newOrder.address,
                    }, stepKey(key, "customer"));
                    customerId = String(created.id);
                    createdCustomerIdRef.current = customerId;
                    setNewOrder((prev) => ({ ...prev, customerId, createNewCustomer: false }));
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
            await loadData();
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
        reload: loadData,
    };
};
