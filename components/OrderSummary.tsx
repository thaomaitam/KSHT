import React, { useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { X, Download, ShoppingBag } from 'lucide-react';
import { useCart } from '../CartContext';
import { settingsService } from '../settingsService';
import { generatePickingSlipContent, PickingSlipItem } from '../utils/pdfGenerator';

interface OrderSummaryProps {
    onClose: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ onClose }) => {
    const { items, getTotalPrice } = useCart();
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

    const totalPrice = getTotalPrice();
    const phoneNumber = settingsService.getPhoneNumber();
    const pickingSlipItems = useMemo<PickingSlipItem[]>(() => items.map(item => ({
        name: item.productName,
        variant: item.variant.size,
        quantity: item.quantity,
        unitPrice: item.variant.price,
        total: item.variant.price * item.quantity,
    })), [items]);

    const handleDownload = async () => {
        if (isGenerating) return;
        setIsGenerating(true);

        let container: HTMLDivElement | null = null;

        try {
            const printContent = generatePickingSlipContent(
                pickingSlipItems,
                totalPrice,
                today,
                phoneNumber
            );

            container = document.createElement('div');
            container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 480px; background: white;';
            container.innerHTML = printContent;
            document.body.appendChild(container);

            const contentElement = container.querySelector('.sheet') as HTMLElement | null;
            if (!contentElement) {
                throw new Error('Picking slip content not found');
            }

            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(contentElement, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false,
                width: contentElement.scrollWidth,
                height: contentElement.scrollHeight,
            });

            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `phieu-soan-hang-${Date.now()}.png`;
            link.click();
        } catch (error) {
            console.error('Error downloading picking slip:', error);
        } finally {
            if (container) {
                document.body.removeChild(container);
            }
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Xác nhận phiếu soạn hàng</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Order Content */}
                <div className="bg-white p-6">
                    {/* Order Header */}
                    <div className="text-center mb-6 pb-4 border-b-2 border-dashed border-slate-200">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-3">
                            <ShoppingBag size={24} className="text-primary-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-1">PHIẾU SOẠN HÀNG</h3>
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
                                {formatter.format(totalPrice)}
                            </span>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="text-center text-sm text-slate-500 pt-4 border-t border-dashed border-slate-200">
                        <p>📱 Số điện thoại liên hệ: <span className="font-semibold text-slate-700">{phoneNumber}</span></p>
                    </div>
                </div>

                {/* Actions */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4">
                    <button
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                        <Download size={18} />
                        <span>{isGenerating ? 'Đang tạo...' : 'Tải về'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
