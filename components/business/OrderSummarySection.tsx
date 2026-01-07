import React from 'react';
import { Printer, Check } from 'lucide-react';
import { NewOrder } from '../../hooks/useBusinessData';

interface OrderSummarySectionProps {
    newOrder: NewOrder;
    setNewOrder: (order: NewOrder) => void;
    getSubtotal: () => number;
    getTotal: () => number;
    formatPrice: (price: number) => string;
    handleCreateAndExportPDF: () => Promise<void>;
    handleThermalPrint: () => Promise<void>;
    handleSaveOrder: () => Promise<any>;
}

export const OrderSummarySection: React.FC<OrderSummarySectionProps> = ({
    newOrder,
    setNewOrder,
    getSubtotal,
    getTotal,
    formatPrice,
    handleCreateAndExportPDF,
    handleThermalPrint,
    handleSaveOrder
}) => {
    return (
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
                            className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-32 bg-slate-50/30 text-sm"
                        />
                    </div>
                </div>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
                <button
                    onClick={handleThermalPrint}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-100 active:scale-95"
                >
                    <Printer size={20} />
                    IN BILL NHIỆT (80MM)
                </button>
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
    );
};
