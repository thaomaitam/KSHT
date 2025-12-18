import React from 'react';
import { History, Search, Filter, Printer, Trash2, Copy, ChevronRight } from 'lucide-react';
import { Order, BankInfo, businessService, Customer } from '../../businessService';
import { generatePDFContent } from '../../utils/pdfGenerator';

interface OrderHistoryTabProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    orderSearch: string;
    setOrderSearch: (search: string) => void;
    bankInfo: BankInfo | null;
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
    orders, setOrders, orderSearch, setOrderSearch, bankInfo, updateCustomer, customers, setCustomers, onRecreateOrder
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

    const handleExportPDF = (order: Order, index: number) => {
        const pdfContent = generatePDFContent(order, bankInfo, orders.length - index);
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
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => onRecreateOrder(order)}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Tạo lại đơn"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleExportPDF(order, index)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="In hóa đơn"
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
