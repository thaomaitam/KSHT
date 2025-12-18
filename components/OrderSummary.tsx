import React, { useRef, useState } from 'react';
import { X, Download, MessageCircle, ShoppingBag } from 'lucide-react';
import { useCart } from '../CartContext';
import { settingsService } from '../settingsService';
import html2canvas from 'html2canvas';

interface OrderSummaryProps {
    onClose: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ onClose }) => {
    const { items, getTotalPrice, clearCart } = useCart();
    const orderRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const formatter = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    });

    const today = new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    const handleDownload = async () => {
        if (!orderRef.current) return;
        setIsGenerating(true);

        try {
            const canvas = await html2canvas(orderRef.current, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
            });

            const link = document.createElement('a');
            link.download = `donhang-giaban-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error generating image:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendZalo = () => {
        // Open Zalo with the shop's number
        window.open(settingsService.getZaloLink(), '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Xác nhận đơn hàng</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Order Content - This will be captured as image */}
                <div ref={orderRef} className="bg-white p-6">
                    {/* Order Header */}
                    <div className="text-center mb-6 pb-4 border-b-2 border-dashed border-slate-200">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-3">
                            <ShoppingBag size={24} className="text-primary-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-1">ĐƠN HÀNG</h3>
                        <p className="text-sm text-slate-500">Ngày: {today}</p>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3 mb-6">
                        {items.map((item, index) => (
                            <div key={`${item.productId}-${item.variant.size}`} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                                <div className="flex-1">
                                    <p className="font-medium text-slate-800 text-sm">
                                        {index + 1}. {item.productName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {item.variant.size} | {item.quantity} x {formatter.format(item.variant.price)}
                                    </p>
                                </div>
                                <p className="font-semibold text-primary-600 text-sm">
                                    {formatter.format(item.variant.price * item.quantity)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Total */}
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-700">TỔNG CỘNG:</span>
                            <span className="text-xl font-bold text-primary-600">
                                {formatter.format(getTotalPrice())}
                            </span>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="text-center text-sm text-slate-500 pt-4 border-t border-dashed border-slate-200">
                        <p>📱 Liên hệ Zalo: <span className="font-semibold text-slate-700">{settingsService.getPhoneNumber()}</span></p>
                    </div>
                </div>

                {/* Actions */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-3">
                    <button
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        <Download size={18} />
                        <span>{isGenerating ? 'Đang tạo...' : 'Tải về'}</span>
                    </button>
                    <button
                        onClick={handleSendZalo}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                    >
                        <MessageCircle size={18} />
                        <span>Gởi Zalo</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
