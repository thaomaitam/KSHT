import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FileText, History, Users, Wallet, BarChart3, DollarSign, Plus, Search, Check, Trash2, Printer, X, ChevronDown, Edit2 } from 'lucide-react';
import { businessService, Order, Customer, Transaction, CostPrice, BankInfo } from '../businessService';
import { storageService } from '../storageService';
import { settingsService, CategoryItem } from '../settingsService';
import { Product } from '../types';
import { isAdminAuthenticated } from './LoginModal';

type TabType = 'orders' | 'history' | 'customers' | 'transactions' | 'reports' | 'costPrices';

interface OrderItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number;
    total: number;
}

interface NewOrder {
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

// Format price helper
const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

// Format date helper
const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
};

export const BusinessPage: React.FC = () => {
    if (!isAdminAuthenticated()) {
        window.location.hash = '#/';
        return null;
    }

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
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [addQuantity, setAddQuantity] = useState(1);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    const productDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
        setCostPrices(costPricesData);
        setProducts(productsData);
        setBankInfo(bankInfoData);
        setCategories(categoriesData);
    };

    const getCategoryLabel = (value: string) => {
        return categories.find(c => c.value === value)?.label || value;
    };

    // Calculate order subtotal
    const getSubtotal = (): number => {
        return newOrder.items.reduce((sum, item) => sum + item.total, 0);
    };

    // Calculate order total
    const getTotal = (): number => {
        return getSubtotal() + (newOrder.shippingFee || 0) + (newOrder.debt || 0) - (newOrder.discount || 0);
    };

    // Add product from dropdown
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

    // Update item field (editable inline)
    const updateItemField = (itemId: string, field: keyof OrderItem, value: string | number) => {
        setNewOrder({
            ...newOrder,
            items: newOrder.items.map(item => {
                if (item.id === itemId) {
                    const updated = { ...item, [field]: value };
                    // Recalculate total if quantity or unitPrice changed
                    if (field === 'quantity' || field === 'unitPrice') {
                        updated.total = (updated.quantity || 0) * (updated.unitPrice || 0);
                    }
                    return updated;
                }
                return item;
            })
        });
    };

    // Remove item from order
    const removeItem = (itemId: string) => {
        setNewOrder({
            ...newOrder,
            items: newOrder.items.filter(item => item.id !== itemId)
        });
    };

    // Save order
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

        // Update or add customer
        await updateCustomer(order);

        // Reset form
        resetOrderForm();
        return order;
    };

    // Generate PDF HTML
    const generatePDFContent = (order: Order): string => {
        const orderNumber = orders.length + 1;
        const today = new Date().toLocaleDateString('vi-VN');

        // Build items HTML
        let itemsHtml = '';
        order.items.forEach((item: OrderItem, index: number) => {
            const weight = item.quantity;
            itemsHtml += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${index + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 13px; font-weight: 600;">${item.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${item.unit}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${item.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${weight}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 13px;">${formatPrice(item.unitPrice)}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 13px; color: #1565C0;">${formatPrice(item.total)}</td>
                </tr>
            `;
        });

        const subtotal = order.items.reduce((sum: number, item: any) => sum + item.total, 0);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Đơn hàng #${orderNumber}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap');
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Roboto', Arial, sans-serif; 
                        margin: 0; 
                        padding: 20px; 
                        background: #fff; 
                        color: #333;
                        font-size: 14px;
                    }
                    .container { 
                        max-width: 800px; 
                        margin: 0 auto; 
                        background: #fff; 
                        padding: 20px;
                    }
                    @media print {
                        body { background: #fff; padding: 0; }
                        .container { box-shadow: none; padding: 10px; }
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 15px;">
                        <h1 style="color: #E91E63; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">KHO SỈ HUY THẢO</h1>
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <p style="color: #64748b; font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px;">
                                <span style="color: #E91E63; font-size: 16px;">📍</span> 119/16A Mễ Cốc, Phường 15, Quận 8, TP.HCM
                            </p>
                            <p style="color: #64748b; font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px;">
                                <span style="color: #E91E63; font-size: 16px;">📞</span> 0964727949
                            </p>
                        </div>
                        <div style="border-bottom: 1px solid #1e293b; margin-top: 15px; width: 100%;"></div>
                    </div>

                    <!-- Info Section -->
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; margin-top: 15px;">
                        <!-- Customer Box -->
                        <div style="flex: 1; background: #F5F5F5; padding: 15px; border: 1px solid #ddd; border-radius: 10px;">
                            <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #000;">
                                KHÁCH HÀNG: ${order.customerName.toUpperCase()}${order.note ? ` ( ${order.note} )` : ''}
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: #333;">
                                <span style="color: #E84393;">📍</span> Địa chỉ: ${order.address || 'Chưa cập nhật'}
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: #333;">
                                <span style="color: #4CAF50;">📞</span> SĐT: ${order.phone || 'Chưa cập nhật'}
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: #333;">
                                <span style="color: #1976D2;">📅</span> Ngày: ${today}
                            </p>
                        </div>
                        
                        <!-- Bank Box -->
                        <div style="flex: 1; background: #E3F2FD; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                            <p style="margin: 0; padding: 10px 15px; font-size: 13px; font-weight: 700; color: #1976D2; background: #E3F2FD; border-bottom: 1px solid #ddd;">
                                ≡ THÔNG TIN CHUYỂN KHOẢN
                            </p>
                            <div style="padding: 12px 15px;">
                                <p style="margin: 5px 0; font-size: 12px; color: #333; font-weight: 700;">
                                    Ngân hàng: <span style="font-weight: 400;">${bankInfo?.bankName || 'SACOMBANK'}</span>
                                </p>
                                <p style="margin: 5px 0; font-size: 12px; color: #333; font-weight: 700;">
                                    Số TK: <span style="font-weight: 400;">${bankInfo?.accountNumber || '050122554391'}</span>
                                </p>
                                <p style="margin: 5px 0; font-size: 12px; color: #333; font-weight: 700;">
                                    Chủ TK: <span style="font-weight: 400;">${bankInfo?.accountName || 'NGUYỄN THANH HUY'}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Product Table -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; border: 1px solid #ddd;">
                        <thead>
                            <tr style="background: #333333;">
                                <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 40px; font-weight: 700;">STT</th>
                                <th style="color: #fff; padding: 10px 6px; text-align: left; border-right: 1px solid #fff; font-size: 12px; font-weight: 700;">Tên hàng</th>
                                <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 60px; font-weight: 700;">ĐVT</th>
                                <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 40px; font-weight: 700;">SL</th>
                                <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 50px; font-weight: 700;">Số kí</th>
                                <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 80px; font-weight: 700;">Đơn giá</th>
                                <th style="color: #fff; padding: 10px 6px; text-align: center; font-size: 12px; width: 100px; font-weight: 700;">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                            <!-- Tạm tính Row -->
                            <tr>
                                <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #000; border-right: none;">Tạm tính:</td>
                                <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #000; font-weight: 700; border-left: 1px solid #ddd;">${formatPrice(subtotal)}</td>
                            </tr>
                            ${order.shippingFee ? `
                            <tr>
                                <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #666; border-right: none; border-top: none;">Phí vận chuyển:</td>
                                <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #666; border-left: 1px solid #ddd; border-top: none;">+${formatPrice(order.shippingFee)}</td>
                            </tr>
                            ` : ''}
                            ${order.discount ? `
                            <tr>
                                <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #e91e63; border-right: none; border-top: none;">Chiết khấu:</td>
                                <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #e91e63; border-left: 1px solid #ddd; border-top: none;">-${formatPrice(order.discount)}</td>
                            </tr>
                            ` : ''}
                            ${order.debt ? `
                            <tr>
                                <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #f57c00; border-right: none; border-top: none;">Công nợ cũ:</td>
                                <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #f57c00; border-left: 1px solid #ddd; border-top: none;">+${formatPrice(order.debt)}</td>
                            </tr>
                            ` : ''}
                            <!-- TỔNG CỘNG Row -->
                            <tr style="background: #4CAF50;">
                                <td colspan="6" style="padding: 10px 15px; text-align: right; font-size: 15px; font-weight: 700; color: #fff; text-transform: uppercase; border-right: 1px solid #fff;">TỔNG CỘNG:</td>
                                <td style="padding: 10px 15px; text-align: right; font-size: 15px; color: #fff; font-weight: 700;">${formatPrice(order.total)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- Footer -->
                    <div style="text-align: center; color: #666; font-size: 12px; margin-top: 40px; padding-top: 10px; border-top: 1px solid #eee;">
                        Cảm ơn quý khách! • Đơn hàng #${orderNumber} • ${today}
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    // Create order and export PDF
    const handleCreateAndExportPDF = async () => {
        // Validate first
        if (!newOrder.customerName.trim()) {
            alert('Vui lòng nhập tên khách hàng');
            return;
        }
        if (newOrder.items.length === 0) {
            alert('Vui lòng thêm ít nhất 1 sản phẩm');
            return;
        }

        // Create order object without saving yet
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

        // Generate and open PDF
        const pdfContent = generatePDFContent(order);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(pdfContent);
            printWindow.document.close();
            printWindow.focus();

            // Auto print after a short delay
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }

        // Save order after opening PDF
        const updatedOrders = await businessService.addOrder(order);
        setOrders(updatedOrders);
        await updateCustomer(order);
        resetOrderForm();
    };

    // Update customer after order
    const updateCustomer = async (order: Order) => {
        const existingCustomer = customers.find(c => c.phone === order.phone || c.name === order.customerName);

        if (existingCustomer) {
            const updated: Customer = {
                ...existingCustomer,
                totalSpent: existingCustomer.totalSpent + order.total,
                lastOrderDate: order.createdAt
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
                lastOrderDate: order.createdAt
            };
            const newCustomers = [newCustomer, ...customers];
            await businessService.saveCustomers(newCustomers);
            setCustomers(newCustomers);
        }
    };

    // Reset order form
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

    // Filter products for dropdown
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10);

    // Filter orders for history
    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.toLowerCase().includes(searchTerm.toLowerCase());
        const orderDate = new Date(order.createdAt);
        const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
        const matchesDateTo = !dateTo || orderDate <= new Date(dateTo + 'T23:59:59');
        return matchesSearch && matchesDateFrom && matchesDateTo;
    });

    // Filter customers
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );

    // Get status badge color
    const getStatusColor = (status: Order['status']) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'shipping': return 'bg-blue-100 text-blue-700';
            case 'completed': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getStatusText = (status: Order['status']) => {
        switch (status) {
            case 'pending': return 'Chưa thu';
            case 'shipping': return 'Đang giao';
            case 'completed': return 'Hoàn thành';
            case 'cancelled': return 'Đã hủy';
            default: return status;
        }
    };

    // Mark order as completed
    const markOrderCompleted = async (orderId: string) => {
        const updated = orders.map(o => o.id === orderId ? { ...o, status: 'completed' as const } : o);
        await businessService.saveOrders(updated);
        setOrders(updated);
    };

    // Delete order
    const deleteOrder = async (orderId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này?')) return;
        const updated = orders.filter(o => o.id !== orderId);
        await businessService.saveOrders(updated);
        setOrders(updated);
    };

    // Create order from customer
    const createOrderFromCustomer = (customer: Customer) => {
        setNewOrder({
            ...newOrder,
            customerName: customer.name,
            phone: customer.phone,
            address: customer.address
        });
        setActiveTab('orders');
    };

    // Reprint order PDF
    const reprintOrderPDF = (order: Order) => {
        const pdfContent = generatePDFContent(order);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(pdfContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };

    // Delete customer
    const handleDeleteCustomer = async (customerId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) return;
        const newCustomers = customers.filter(c => c.id !== customerId);
        await businessService.saveCustomers(newCustomers);
        setCustomers(newCustomers);
    };

    // Update customer
    const handleUpdateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCustomer) return;

        const newCustomers = customers.map(c => c.id === editingCustomer.id ? editingCustomer : c);
        await businessService.saveCustomers(newCustomers);
        setCustomers(newCustomers);
        setEditingCustomer(null);
    };

    // Reorder (copy order to form)
    const handleReorder = (order: Order) => {
        setNewOrder({
            customerName: order.customerName,
            phone: order.phone || '',
            address: order.address || '',
            items: order.items.map(item => ({ ...item, id: 'item_' + Date.now() + Math.random() })),
            shippingFee: order.shippingFee || 0,
            discount: order.discount || 0,
            debt: order.debt || 0,
            note: order.note || '',
            isManualEntry: false
        });
        setActiveTab('orders');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Tabs configuration
    const tabs = [
        { id: 'orders' as TabType, label: 'Đơn hàng', icon: FileText },
        { id: 'history' as TabType, label: 'Lịch sử', icon: History },
        { id: 'customers' as TabType, label: 'Khách hàng', icon: Users },
        { id: 'transactions' as TabType, label: 'Thu chi', icon: Wallet },
        { id: 'reports' as TabType, label: 'Báo cáo', icon: BarChart3 },
        { id: 'costPrices' as TabType, label: 'Giá gốc', icon: DollarSign }
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <a
                                href="#/admin"
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                <ArrowLeft size={20} />
                                <span className="hidden sm:inline font-medium">Quản lý SP</span>
                            </a>
                            <div className="h-6 w-px bg-slate-200" />
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <BarChart3 size={24} className="text-green-600" />
                                Quản lý kinh doanh
                            </h1>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Orders Tab - Create New Order */}
                {activeTab === 'orders' && (
                    <div className="space-y-6">
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                                <FileText size={20} className="text-green-600" />
                                <h2 className="font-semibold text-slate-800">Tạo đơn hàng mới</h2>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Customer Info */}
                                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                                    <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                        Thông tin khách hàng
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input
                                            type="text"
                                            placeholder="Tên khách hàng *"
                                            value={newOrder.customerName}
                                            onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                                            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                        />
                                        <input
                                            type="tel"
                                            placeholder="Số điện thoại"
                                            value={newOrder.phone}
                                            onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                                            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ"
                                            value={newOrder.address}
                                            onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                                            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                        />
                                    </div>
                                </div>

                                {/* Add Products */}
                                <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-medium text-slate-700 flex items-center gap-2">
                                            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                            Thêm sản phẩm
                                        </h3>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={newOrder.isManualEntry}
                                                onChange={(e) => setNewOrder({ ...newOrder, isManualEntry: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="text-slate-600 font-medium">Nhập tay (không có trong DS)</span>
                                        </label>
                                    </div>

                                    {!newOrder.isManualEntry ? (
                                        /* Product Search Dropdown */
                                        <div className="flex flex-col md:flex-row gap-4 items-center" ref={productDropdownRef}>
                                            <div className="flex-1 w-full relative">
                                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Tìm sản phẩm..."
                                                    value={productSearch}
                                                    onChange={(e) => {
                                                        setProductSearch(e.target.value);
                                                        setShowProductDropdown(true);
                                                    }}
                                                    onFocus={() => setShowProductDropdown(true)}
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                                />
                                                {showProductDropdown && productSearch && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-80 overflow-auto">
                                                        {filteredProducts.length > 0 ? (
                                                            filteredProducts.map(product => (
                                                                <button
                                                                    key={product.id}
                                                                    onClick={() => addProductFromList(product)}
                                                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0"
                                                                >
                                                                    <img
                                                                        src={product.image}
                                                                        alt={product.name}
                                                                        className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                                                                    />
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-slate-800">{product.name}</div>
                                                                        <div className="text-xs text-slate-500">
                                                                            {product.variants.length} loại • từ {formatPrice(Math.min(...product.variants.map(v => v.price)))}
                                                                        </div>
                                                                    </div>
                                                                    <ChevronDown size={16} className="text-slate-400" />
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-4 py-3 text-slate-500">Không tìm thấy sản phẩm</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 bg-white px-4 py-2 border border-slate-200 rounded-xl">
                                                <span className="text-sm font-medium text-slate-500">SL:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={addQuantity}
                                                    onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                                                    className="w-16 py-1 text-center font-bold text-slate-800 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        /* Manual Entry - Add empty row */
                                        <button
                                            onClick={() => {
                                                const newItem: OrderItem = {
                                                    id: 'item_' + Date.now(),
                                                    name: '',
                                                    unit: 'Cây',
                                                    quantity: 1,
                                                    unitPrice: 0,
                                                    total: 0
                                                };
                                                setNewOrder({
                                                    ...newOrder,
                                                    items: [...newOrder.items, newItem]
                                                });
                                            }}
                                            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                                        >
                                            <Plus size={18} />
                                            Thêm dòng mới
                                        </button>
                                    )}
                                </div>

                                {/* Order Items List - Editable Table */}
                                {newOrder.items.length > 0 && (
                                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <table className="w-full">
                                            <thead className="bg-slate-50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-4 text-left">Sản phẩm</th>
                                                    <th className="px-4 py-4 text-center w-24">ĐVT</th>
                                                    <th className="px-4 py-4 text-center w-20">SL</th>
                                                    <th className="px-4 py-4 text-right w-32">Đơn giá</th>
                                                    <th className="px-4 py-4 text-right w-32">Thành tiền</th>
                                                    <th className="px-4 py-4 w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {newOrder.items.map(item => (
                                                    <tr key={item.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="text"
                                                                value={item.name}
                                                                onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                                placeholder="Tên sản phẩm"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <input
                                                                type="text"
                                                                value={item.unit}
                                                                onChange={(e) => updateItemField(item.id, 'unit', e.target.value)}
                                                                className="w-full px-2 py-2 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                                placeholder="ĐVT"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItemField(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                                className="w-full px-2 py-2 border border-slate-200 rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.unitPrice}
                                                                onChange={(e) => updateItemField(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                                                                className="w-full px-2 py-2 border border-slate-200 rounded-lg text-right font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4 text-right font-bold text-slate-700">
                                                            {formatPrice(item.total)}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <button
                                                                onClick={() => removeItem(item.id)}
                                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Order Summary & Actions */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
                                    <div className="lg:col-span-8 space-y-4">
                                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex justify-between items-center text-slate-600">
                                                    <span className="font-medium">Tạm tính:</span>
                                                    <span className="font-bold text-slate-800">{formatPrice(getSubtotal())}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="font-medium text-slate-600">Phí vận chuyển:</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={newOrder.shippingFee || ''}
                                                        onChange={(e) => setNewOrder({ ...newOrder, shippingFee: parseInt(e.target.value) || 0 })}
                                                        className="w-32 px-4 py-2 border border-slate-200 rounded-xl text-right font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="font-medium text-slate-600">Chiết khấu:</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={newOrder.discount || ''}
                                                        onChange={(e) => setNewOrder({ ...newOrder, discount: parseInt(e.target.value) || 0 })}
                                                        className="w-32 px-4 py-2 border border-slate-200 rounded-xl text-right font-bold text-red-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="font-medium text-slate-600">Công nợ:</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={newOrder.debt || ''}
                                                        onChange={(e) => setNewOrder({ ...newOrder, debt: parseInt(e.target.value) || 0 })}
                                                        className="w-32 px-4 py-2 border border-slate-200 rounded-xl text-right font-bold text-orange-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                                    <span className="text-lg font-bold text-slate-800">Tổng cộng:</span>
                                                    <span className="text-2xl font-black text-emerald-600">{formatPrice(getTotal())}</span>
                                                </div>
                                            </div>
                                            <div className="hidden md:block w-px h-24 bg-slate-100"></div>
                                            <div className="flex-1">
                                                <textarea
                                                    placeholder="Ghi chú đơn hàng..."
                                                    value={newOrder.note}
                                                    onChange={(e) => setNewOrder({ ...newOrder, note: e.target.value })}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-32 bg-slate-50/30"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
                                        <button
                                            onClick={handleCreateAndExportPDF}
                                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 active:scale-95"
                                        >
                                            <Printer size={20} />
                                            Tạo đơn & Xuất PDF
                                        </button>
                                        <button
                                            onClick={() => handleSaveOrder()}
                                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-emerald-100 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all active:scale-95"
                                        >
                                            <Check size={20} />
                                            Lưu đơn
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                            <History size={20} className="text-green-600" />
                            <h2 className="font-semibold text-slate-800">Lịch sử đơn hàng ({filteredOrders.length})</h2>
                        </div>
                        <div className="p-6">
                            {/* Filters */}
                            <div className="flex flex-wrap gap-4 mb-6">
                                <div className="flex-1 min-w-[200px] relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm theo tên, số đơn..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            {/* Orders List */}
                            <div className="space-y-3">
                                {filteredOrders.map((order, index) => (
                                    <div key={order.id} className="border-b border-slate-100 py-5 last:border-0 hover:bg-slate-50/50 transition-colors px-4 -mx-4 rounded-xl">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-xs font-medium text-slate-400">#{orders.length - index}</span>
                                                    <span className="font-bold text-slate-800 uppercase tracking-tight">{order.customerName}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${getStatusColor(order.status)}`}>
                                                        {order.status === 'pending' && <span className="text-xs">⏳</span>}
                                                        {getStatusText(order.status)}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-500 font-medium">
                                                    {formatDate(order.createdAt)} • {order.items.length} sản phẩm
                                                    {order.discount ? <span className="text-red-500 ml-2">-CK: {formatPrice(order.discount)}</span> : null}
                                                    {order.debt ? <span className="text-orange-500 ml-2">+Nợ: {formatPrice(order.debt)}</span> : null}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black text-emerald-600 mb-3">{formatPrice(order.total)}</div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleReorder(order)}
                                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                                                    >
                                                        Tạo lại đơn
                                                    </button>
                                                    <button
                                                        onClick={() => reprintOrderPDF(order)}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                                                    >
                                                        Xuất PDF
                                                    </button>
                                                    {order.status !== 'completed' && (
                                                        <button
                                                            onClick={() => markOrderCompleted(order.id)}
                                                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                            title="Đã thu tiền"
                                                        >
                                                            <Check size={16} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteOrder(order.id)}
                                                        className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                        title="Xóa đơn"
                                                    >
                                                        <Trash2 size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredOrders.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        Chưa có đơn hàng nào
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Customers Tab */}
                {activeTab === 'customers' && (
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                            <Users size={20} className="text-green-600" />
                            <h2 className="font-semibold text-slate-800">Danh sách khách hàng ({customers.length})</h2>
                        </div>
                        <div className="p-6">
                            {/* Search */}
                            <div className="relative mb-6 max-w-md">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên, SDT..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>

                            {/* Customers List */}
                            <div className="space-y-3">
                                {filteredCustomers.map(customer => (
                                    <div key={customer.id} className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-slate-800">{customer.name}</div>
                                                <div className="text-sm text-slate-500 flex items-center gap-3">
                                                    <span className="text-green-600">📞 {customer.phone}</span>
                                                    <span>• {orders.filter(o => o.phone === customer.phone).length} đơn</span>
                                                    {customer.lastOrderDate && (
                                                        <span>• Gần nhất: {formatDate(customer.lastOrderDate)}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => createOrderFromCustomer(customer)}
                                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                                                >
                                                    Tạo đơn mới
                                                </button>
                                                <button
                                                    onClick={() => setEditingCustomer(customer)}
                                                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Sửa thông tin"
                                                >
                                                    <Edit2 size={16} strokeWidth={2.5} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustomer(customer.id)}
                                                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Xóa khách hàng"
                                                >
                                                    <Trash2 size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        Chưa có khách hàng nào
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                            <Wallet size={20} className="text-green-600" />
                            <h2 className="font-semibold text-slate-800">Lợi nhuận theo đơn hàng</h2>
                        </div>
                        <div className="p-6">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Đơn hàng</th>
                                            <th className="px-4 py-3 text-right">Doanh thu</th>
                                            <th className="px-4 py-3 text-right">Vốn</th>
                                            <th className="px-4 py-3 text-right">Lợi nhuận</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredOrders.map(order => {
                                            const subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
                                            const cost = order.items.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);
                                            const profit = (subtotal - cost) - (order.discount || 0);
                                            return (
                                                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="font-bold text-slate-800 uppercase">{order.customerName}</div>
                                                        <div className="text-xs text-slate-500">{formatDate(order.createdAt)}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right font-medium text-slate-900">
                                                        <div>{formatPrice(subtotal)}</div>
                                                        {order.discount > 0 && <div className="text-xs text-red-500">-{formatPrice(order.discount)} CK</div>}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-slate-500">{formatPrice(cost)}</td>
                                                    <td className="px-4 py-4 text-right font-bold text-emerald-600">{formatPrice(profit)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* Reports Tab */}
                {activeTab === 'reports' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-slate-500 text-sm font-medium mb-1">Tổng doanh thu</div>
                                <div className="text-2xl font-black text-slate-800">{formatPrice(orders.reduce((sum, o) => sum + o.total, 0))}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-slate-500 text-sm font-medium mb-1">Đã thu (Hoàn thành)</div>
                                <div className="text-2xl font-black text-emerald-600">{formatPrice(orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0))}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-slate-500 text-sm font-medium mb-1">Chưa thu</div>
                                <div className="text-2xl font-black text-orange-500">{formatPrice(orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0))}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-slate-500 text-sm font-medium mb-1">Tổng đơn hàng</div>
                                <div className="text-2xl font-black text-blue-600">{orders.length} đơn</div>
                            </div>
                        </div>

                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                                <BarChart3 size={20} className="text-green-600" />
                                <h2 className="font-semibold text-slate-800">Thống kê chi tiết</h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Trạng thái đơn hàng</h3>
                                        <div className="space-y-3">
                                            {['pending', 'shipping', 'completed', 'cancelled'].map(status => {
                                                const count = orders.filter(o => o.status === status).length;
                                                const percentage = orders.length ? (count / orders.length * 100).toFixed(0) : 0;
                                                return (
                                                    <div key={status} className="flex items-center gap-4">
                                                        <div className="w-24 text-sm font-medium text-slate-600">{getStatusText(status as any)}</div>
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full ${getStatusColor(status as any).split(' ')[0].replace('bg-', 'bg-opacity-100 bg-')}`} style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                        <div className="w-12 text-right text-sm font-bold text-slate-800">{count}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Khách hàng tiêu biểu</h3>
                                        <div className="space-y-3">
                                            {customers.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5).map(customer => (
                                                <div key={customer.id} className="flex items-center justify-between">
                                                    <div className="text-sm font-medium text-slate-800">{customer.name}</div>
                                                    <div className="text-sm font-bold text-emerald-600">{formatPrice(customer.totalSpent)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* Cost Prices Tab */}
                {activeTab === 'costPrices' && (
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <DollarSign size={20} className="text-green-600" />
                                <h2 className="font-semibold text-slate-800">Quản lý giá gốc sản phẩm</h2>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm sản phẩm..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Sản phẩm</th>
                                            <th className="px-4 py-3 text-left">Phân loại</th>
                                            <th className="px-4 py-3 text-right">Giá bán</th>
                                            <th className="px-4 py-3 text-right">Giá gốc</th>
                                            <th className="px-4 py-3 text-right">Lợi nhuận dự kiến</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
                                            product.variants.map((variant, vIdx) => (
                                                <tr key={`${product.id}-${vIdx}`} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="font-medium text-slate-800">{product.name}</div>
                                                        <div className="text-xs text-slate-500">{variant.size}</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-sm text-slate-600">{getCategoryLabel(product.category)}</td>
                                                    <td className="px-4 py-4 text-right font-medium text-slate-900">{formatPrice(variant.price)}</td>
                                                    <td className="px-4 py-4 text-right text-orange-600 font-medium">{formatPrice(variant.costPrice || 0)}</td>
                                                    <td className="px-4 py-4 text-right font-bold text-emerald-600">
                                                        {formatPrice(variant.price - (variant.costPrice || 0))}
                                                    </td>
                                                </tr>
                                            ))
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* Edit Customer Modal */}
            {editingCustomer && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Edit2 size={18} className="text-blue-600" />
                                Chỉnh sửa khách hàng
                            </h3>
                            <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateCustomer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Tên khách hàng</label>
                                <input
                                    type="text"
                                    required
                                    value={editingCustomer.name}
                                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Số điện thoại</label>
                                <input
                                    type="text"
                                    value={editingCustomer.phone}
                                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Địa chỉ</label>
                                <textarea
                                    value={editingCustomer.address}
                                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingCustomer(null)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                                >
                                    Lưu thay đổi
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
