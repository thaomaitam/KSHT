import React from 'react';
import html2canvas from 'html2canvas';
import { History, Search, Filter, Printer, Trash2, RotateCcw, ChevronRight } from 'lucide-react';
import { Order, BankInfo, ShopTemplate, businessService, Customer } from '../../businessService';
import { generatePDFContent, generateReceiptContent } from '../../utils/pdfGenerator';

interface OrderHistoryTabProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    orderSearch: string;
    setOrderSearch: (search: string) => void;
    bankInfo: BankInfo | null;
    shopTemplates: ShopTemplate[];
    updateCustomer: (order: Order) => Promise<void>;
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    onRecreateOrder: (order: Order) => void;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const OrderHistoryTab: React.FC<OrderHistoryTabProps> = ({
    orders, setOrders, orderSearch, setOrderSearch, bankInfo, shopTemplates, updateCustomer, customers, setCustomers, onRecreateOrder
}) => {

    const filteredOrders = orders.filter(order =>
        order.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
        order.phone.includes(orderSearch) ||
        order.id.includes(orderSearch)
    );

    const handleDeleteOrder = async (orderId: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa đơn hàng này?')) {
            const updatedOrders = await businessService.deleteOrder(orderId);
            setOrders(updatedOrders);
        }
    };

    const togglePaymentStatus = async (order: Order) => {
        const newStatus = order.paymentStatus === 'paid' ? 'unpaid' : 'paid';
        const oldDebt = order.debt || 0;
        let newDebt = oldDebt;

        if (newStatus === 'paid') {
            newDebt = 0;
        } else {
            // Revert to full debt if marking as unpaid
            newDebt = order.total;
        }

        const updatedOrder: Order = {
            ...order,
            paymentStatus: newStatus,
            debt: newDebt
        };

        // Update Order
        const updatedOrders = await businessService.updateOrder(updatedOrder);
        setOrders(updatedOrders);

        // Update Customer
        const customer = customers.find(c => c.phone === order.phone || c.name === order.customerName);
        if (customer) {
            const debtDifference = newDebt - oldDebt;
            const updatedCustomer = {
                ...customer,
                debt: (customer.debt || 0) + debtDifference
            };
            await businessService.updateCustomer(updatedCustomer);
            setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
        }
    };

    const handleExportPDF = async (order: Order, index: number) => {
        // Find the template used for this order, or use default
        const savedTemplate = shopTemplates.find(t => t.id === order.shopTemplateId);
        const defaultTemplate = shopTemplates.find(t => t.isDefault);
        const templateToUse = savedTemplate || defaultTemplate || shopTemplates[0];

        const pdfContent = generatePDFContent(order, bankInfo, orders.length - index, templateToUse);

        // Create hidden container to render the invoice HTML
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 800px; background: white;';
        container.innerHTML = pdfContent;
        document.body.appendChild(container);

        // Find the actual content container inside the HTML
        const contentElement = container.querySelector('.container') as HTMLElement;
        if (!contentElement) {
            document.body.removeChild(container);
            // Fallback to old method
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(pdfContent);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => printWindow.print(), 500);
            }
            return;
        }

        // Wait for fonts and images to load
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Convert HTML to PNG using html2canvas
            const canvas = await html2canvas(contentElement, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                width: contentElement.scrollWidth,
                height: contentElement.scrollHeight
            });

            const imageDataUrl = canvas.toDataURL('image/png');
            document.body.removeChild(container);

            // Open new window with the image
            const imageWindow = window.open('', '_blank');
            if (imageWindow) {
                const orderNumber = orders.length - index;
                imageWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Đơn hàng #${orderNumber}</title>
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body { 
                                background: #1a1a2e; 
                                min-height: 100vh; 
                                display: flex; 
                                flex-direction: column;
                                align-items: center; 
                                padding: 20px;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            }
                            .toolbar {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                display: flex;
                                gap: 10px;
                                z-index: 100;
                            }
                            .btn {
                                padding: 12px 24px;
                                border: none;
                                border-radius: 8px;
                                font-size: 14px;
                                font-weight: 600;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                transition: all 0.2s;
                            }
                            .btn-print {
                                background: #4CAF50;
                                color: white;
                            }
                            .btn-print:hover { background: #45a049; }
                            .hint {
                                position: fixed;
                                bottom: 20px;
                                left: 50%;
                                transform: translateX(-50%);
                                background: rgba(255,255,255,0.9);
                                padding: 12px 24px;
                                border-radius: 8px;
                                font-size: 13px;
                                color: #333;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            }
                            .invoice-image {
                                max-width: 100%;
                                height: auto;
                                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                                border-radius: 8px;
                                margin-top: 20px;
                            }
                            @media print {
                                body { background: white; padding: 0; }
                                .toolbar, .hint { display: none !important; }
                                .invoice-image { 
                                    box-shadow: none; 
                                    border-radius: 0;
                                    max-width: 100%;
                                    margin: 0;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="toolbar">
                            <button class="btn btn-print" onclick="window.print()">
                                🖨️ In PDF
                            </button>
                        </div>
                        <img src="${imageDataUrl}" alt="Hoá đơn" class="invoice-image" />
                        <div class="hint">
                            💡 <strong>Tip:</strong> Chuột phải vào ảnh → Sao chép hình ảnh để gửi khách qua Zalo/Messenger
                        </div>
                    </body>
                    </html>
                `);
                imageWindow.document.close();
            }
        } catch (error) {
            console.error('Error generating invoice image:', error);
            document.body.removeChild(container);

            // Fallback to old PDF method
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(pdfContent);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        }
    };

    const handleThermalPrint = (order: Order, index: number) => {
        // Find the template used for this order, or use default
        const savedTemplate = shopTemplates.find(t => t.id === order.shopTemplateId);
        const defaultTemplate = shopTemplates.find(t => t.isDefault);
        const templateToUse = savedTemplate || defaultTemplate || shopTemplates[0];

        const orderNumber = orders.length - index;
        const receiptContent = generateReceiptContent(order, orderNumber, templateToUse, bankInfo);

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <History size={20} className="text-blue-600" />
                        <h2 className="font-semibold text-slate-800">Lịch sử đơn hàng</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên, SĐT, mã đơn..."
                                value={orderSearch}
                                onChange={(e) => setOrderSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
                            />
                        </div>
                        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200">
                            <Filter size={18} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 text-left">Ngày tạo</th>
                                <th className="px-6 py-4 text-left">Khách hàng</th>
                                <th className="px-6 py-4 text-right">Tổng tiền</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.length > 0 ? (
                                filteredOrders.map((order, index) => (
                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-700">{formatDate(order.createdAt)}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5">#{order.id.slice(-6).toUpperCase()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-800">{order.customerName}</div>
                                            <div className="text-xs text-slate-500">{order.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="text-sm font-bold text-slate-900">{formatPrice(order.total)}</div>
                                            {order.debt > 0 && (
                                                <div className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded inline-block">
                                                    Nợ: {formatPrice(order.debt)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {order.status === 'completed' ? 'Hoàn thành' : 'Chờ xử lý'}
                                            </span>
                                            <div className="mt-2">
                                                <button
                                                    onClick={() => togglePaymentStatus(order)}
                                                    className={`text-xs px-2 py-1 rounded border ${order.paymentStatus === 'paid'
                                                        ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                                        : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                                                        }`}
                                                >
                                                    {order.paymentStatus === 'paid' ? 'Đã thu tiền' : 'Chưa thu tiền'}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleThermalPrint(order, index)}
                                                    className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                    title="IN BILL NHIỆT"
                                                >
                                                    <Printer size={16} className="text-orange-500" />
                                                </button>
                                                <button
                                                    onClick={() => onRecreateOrder(order)}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Tạo lại đơn"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleExportPDF(order, index)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="In hóa đơn PDF"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Xóa đơn"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <History size={40} className="text-slate-200" />
                                            <p>Chưa có đơn hàng nào</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
