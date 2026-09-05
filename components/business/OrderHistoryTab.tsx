import React from 'react';
import html2canvas from 'html2canvas';
import { History, Search, Printer, RotateCcw } from 'lucide-react';
import { Order, BankInfo, ShopTemplate, businessService, Customer, OrderStatus, PaymentRecord } from '../../businessService';
import { generateImagePreviewContent, generatePDFContent, generateReceiptContent, openPrintWindow } from '../../utils/pdfGenerator';
import {
    INCOMPLETE_PAGES_MESSAGE,
    REFUND_CONFIRM_MESSAGE,
    createOrderHistoryActions,
    printShopTemplate,
} from '../../utils/orderActions';
import { NoticeBanner } from '../NoticeBanner';

interface OrderHistoryTabProps {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    orderSearch: string;
    setOrderSearch: (search: string) => void;
    bankInfo: BankInfo | null;
    shopTemplates: ShopTemplate[];
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    onRecreateOrder: (order: Order) => void;
    truncated?: boolean;
    onReload?: () => Promise<void>;
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

const STATUS_LABEL: Record<OrderStatus, string> = {
    draft: 'Nháp',
    confirmed: 'Đã xác nhận',
    shipping: 'Đang giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    discarded: 'Đã bỏ',
};

const STATUS_CLASS: Record<OrderStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    confirmed: 'bg-blue-100 text-blue-800',
    shipping: 'bg-amber-100 text-amber-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    discarded: 'bg-slate-100 text-slate-500',
};

export const OrderHistoryTab: React.FC<OrderHistoryTabProps> = ({
    orders, setOrders, orderSearch, setOrderSearch, bankInfo, setCustomers, onRecreateOrder, truncated, onReload,
}) => {
    const actionsRef = React.useRef<ReturnType<typeof createOrderHistoryActions> | null>(null);
    const actions = actionsRef.current ?? (actionsRef.current = createOrderHistoryActions({
        getOrderInvoice: (id) => businessService.getOrderInvoice(id),
        recordPayment: (orderId, amount, method, note, key) =>
            businessService.recordPayment(orderId, amount, method, note, key),
        refundPayment: (paymentId, amount, reason) => businessService.refundPayment(paymentId, amount, reason),
        listPayments: (orderId) => businessService.listPayments(orderId),
    }));
    const [view, setView] = React.useState(() => actions.snapshot());
    const sync = React.useCallback(() => setView(actions.snapshot()), [actions]);

    const filteredOrders = orders.filter(order =>
        order.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
        order.phone.includes(orderSearch) ||
        order.id.includes(orderSearch)
    );

    const refresh = async (next?: { items: Order[] }) => {
        if (next) setOrders(next.items);
        else if (onReload) await onReload();
        try {
            setCustomers((await businessService.getCustomers()).items);
        } catch {
            // keep current customers
        }
    };

    const handleExportPDF = async (order: Order, index: number) => {
        const pending = actions.loadInvoiceForPrint(order);
        sync();
        const invoice = await pending;
        sync();
        if (!invoice) return;
        const templateToUse = printShopTemplate(invoice);
        const pdfContent = generatePDFContent(invoice, bankInfo, orders.length - index, templateToUse);
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 800px; background: white;';
        container.innerHTML = pdfContent;
        document.body.appendChild(container);
        const contentElement = container.querySelector('.container') as HTMLElement;
        if (!contentElement) {
            document.body.removeChild(container);
            const printWindow = openPrintWindow(pdfContent);
            if (printWindow) setTimeout(() => printWindow.print(), 500);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
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
            openPrintWindow(generateImagePreviewContent(
                `Phiếu xuất kho #${orders.length - index}`,
                imageDataUrl,
                'Hoá đơn'
            ));
        } catch (error) {
            console.error('Error generating invoice image:', error);
            document.body.removeChild(container);
            const printWindow = openPrintWindow(pdfContent);
            if (printWindow) {
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        }
    };

    const handleThermalPrint = async (order: Order, index: number) => {
        const pending = actions.loadInvoiceForPrint(order);
        sync();
        const invoice = await pending;
        sync();
        if (!invoice) return;
        const templateToUse = printShopTemplate(invoice);
        const printWindow = openPrintWindow(generateReceiptContent(invoice, orders.length - index, templateToUse, bankInfo));
        if (printWindow) {
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }
    };

    const handleRecreate = async (order: Order) => {
        const pending = actions.loadInvoiceForRecreate(order);
        sync();
        const invoice = await pending;
        sync();
        if (invoice) onRecreateOrder(invoice);
    };

    return (
        <div className="space-y-6">
            {view.notice && (
                <NoticeBanner
                    kind={view.notice.kind}
                    title={view.notice.title}
                    message={view.notice.message}
                />
            )}
            {truncated && (
                <NoticeBanner
                    kind="warning"
                    title="Lịch sử đơn bị cắt"
                    message={INCOMPLETE_PAGES_MESSAGE}
                />
            )}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <History size={20} className="text-blue-600" />
                        <h2 className="font-semibold text-slate-800">Lịch sử đơn hàng</h2>
                    </div>
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
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 text-left">Ngày tạo</th>
                                <th className="px-6 py-4 text-left">Khách hàng</th>
                                <th className="px-6 py-4 text-right">Tổng / còn thu</th>
                                <th className="px-6 py-4 text-center">Trạng thái</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.length > 0 ? (
                                filteredOrders.map((order, index) => (
                                    <React.Fragment key={order.id}>
                                        <tr className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-700">{formatDate(order.createdAt)}</div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{order.id}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-800">{order.customerName || '—'}</div>
                                                <div className="text-xs text-slate-500">{order.phone}</div>
                                                {!order.customerId && <div className="text-[10px] text-amber-600 font-bold">Thiếu customerId (lịch sử)</div>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-sm font-bold text-slate-900">{formatPrice(order.total)}</div>
                                                <div className="text-[10px] font-bold text-orange-600">Còn thu: {formatPrice(order.outstanding || 0)}</div>
                                                <div className="text-[10px] text-slate-500">Đã thu ròng: {formatPrice(order.netCollected || 0)}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[order.status]}`}>
                                                    {STATUS_LABEL[order.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-wrap items-center justify-end gap-2">
                                                    {order.status === 'draft' && (
                                                        <button
                                                            className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 disabled:opacity-50"
                                                            disabled={view.busy}
                                                            onClick={async () => {
                                                                const pending = actions.run('confirm', () => businessService.transitionOrder(order, 'confirmed'));
                                                                sync();
                                                                const next = await pending;
                                                                sync();
                                                                if (next) await refresh(next);
                                                            }}
                                                        >Xác nhận</button>
                                                    )}
                                                    {order.status === 'confirmed' && (
                                                        <button
                                                            className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 disabled:opacity-50"
                                                            disabled={view.busy}
                                                            onClick={async () => {
                                                                const pending = actions.run('shipping', () => businessService.transitionOrder(order, 'shipping'));
                                                                sync();
                                                                const next = await pending;
                                                                sync();
                                                                if (next) await refresh(next);
                                                            }}
                                                        >Giao hàng</button>
                                                    )}
                                                    {order.status === 'shipping' && (
                                                        <button
                                                            className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 disabled:opacity-50"
                                                            disabled={view.busy}
                                                            onClick={async () => {
                                                                const pending = actions.run('complete', () => businessService.transitionOrder(order, 'completed'));
                                                                sync();
                                                                const next = await pending;
                                                                sync();
                                                                if (next) await refresh(next);
                                                            }}
                                                        >Hoàn thành</button>
                                                    )}
                                                    {order.status === 'draft' && (
                                                        <button
                                                            className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 disabled:opacity-50"
                                                            disabled={view.busy}
                                                            onClick={async () => {
                                                                const pending = actions.run('discard', () => businessService.discardDraft(order));
                                                                sync();
                                                                const next = await pending;
                                                                sync();
                                                                if (next) await refresh(next);
                                                            }}
                                                        >Bỏ nháp</button>
                                                    )}
                                                    {(order.status === 'confirmed' || order.status === 'shipping') && (
                                                        <button
                                                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 disabled:opacity-50"
                                                            disabled={view.busy}
                                                            onClick={async () => {
                                                                const reason = actions.snapshot().cancelReason || window.prompt('Lý do hủy đơn') || '';
                                                                if (!reason.trim()) return;
                                                                const pending = actions.run('cancel', () => businessService.cancelOrder(order.id, reason.trim()));
                                                                sync();
                                                                const next = await pending;
                                                                sync();
                                                                if (next) await refresh(next);
                                                            }}
                                                        >Hủy</button>
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            await actions.expandOrder(order.id);
                                                            sync();
                                                        }}
                                                        className="text-xs px-2 py-1 rounded border border-slate-200"
                                                    >Thu/chi</button>
                                                    <button
                                                        onClick={() => handleThermalPrint(order, index)}
                                                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50"
                                                        disabled={view.busy}
                                                        title="IN BILL NHIỆT"
                                                    ><Printer size={16} /></button>
                                                    <button
                                                        onClick={() => handleRecreate(order)}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-50"
                                                        disabled={view.busy}
                                                        title="Tạo lại đơn"
                                                    ><RotateCcw size={16} /></button>
                                                    <button
                                                        onClick={() => handleExportPDF(order, index)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                                                        disabled={view.busy}
                                                        title="In hóa đơn PDF"
                                                    ><Printer size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {view.expandedId === order.id && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-4 bg-slate-50">
                                                    <div className="space-y-3 text-sm">
                                                        <p className="font-semibold">Thanh toán bất biến (không gạt đã thu/chưa thu)</p>
                                                        {view.paymentsTruncated && <NoticeBanner kind="warning" message={INCOMPLETE_PAGES_MESSAGE} />}
                                                        {view.payments.length === 0 && <p className="text-slate-500">Chưa có phiếu thu.</p>}
                                                        {view.payments.map((payment: PaymentRecord) => (
                                                            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                                                                <span>{formatDate(payment.createdAt)} · {payment.method} · {formatPrice(payment.amount)}</span>
                                                                <span>Còn hiệu lực: {formatPrice(payment.remaining)}</span>
                                                                {payment.remaining > 0 && (
                                                                    <button
                                                                        className="text-xs text-red-600 disabled:opacity-50"
                                                                        disabled={view.busy}
                                                                        onClick={async () => {
                                                                            const reason = window.prompt('Lý do hoàn') || '';
                                                                            if (!reason.trim()) return;
                                                                            const confirmed = window.confirm(REFUND_CONFIRM_MESSAGE);
                                                                            const pending = actions.refundRemaining(order.id, payment, reason.trim(), confirmed);
                                                                            sync();
                                                                            const refunded = await pending;
                                                                            sync();
                                                                            if (refunded && onReload) await onReload();
                                                                        }}
                                                                    >Hoàn phần còn lại</button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {(order.status === 'confirmed' || order.status === 'shipping' || order.status === 'completed') && (order.outstanding || 0) > 0 && (
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    className="px-3 py-2 border rounded-xl w-40"
                                                                    placeholder="Số thu thêm"
                                                                    value={view.payAmount}
                                                                    onChange={(e) => {
                                                                        actions.setPayAmount(e.target.value);
                                                                        sync();
                                                                    }}
                                                                />
                                                                <button
                                                                    className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                                                                    disabled={view.busy}
                                                                    onClick={async () => {
                                                                        const pending = actions.recordPayment(order.id);
                                                                        sync();
                                                                        const recorded = await pending;
                                                                        sync();
                                                                        if (recorded && onReload) await onReload();
                                                                    }}
                                                                >Ghi phiếu thu</button>
                                                            </div>
                                                        )}
                                                        {(order.status === 'confirmed' || order.status === 'shipping') && (
                                                            <input
                                                                className="w-full px-3 py-2 border rounded-xl"
                                                                placeholder="Lý do hủy (bắt buộc)"
                                                                value={view.cancelReason}
                                                                onChange={(e) => {
                                                                    actions.setCancelReason(e.target.value);
                                                                    sync();
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
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
