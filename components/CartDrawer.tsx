import React, { useState } from 'react';
import { X, ShoppingCart, Plus, Minus, Trash2, Send } from 'lucide-react';
import { useCart } from '../CartContext';
import { OrderSummary } from './OrderSummary';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
    const { items, removeFromCart, updateQuantity, getTotalPrice, clearCart } = useCart();
    const [showOrderSummary, setShowOrderSummary] = useState(false);

    const formatter = new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    });

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-100 p-2 rounded-lg">
                            <ShoppingCart size={20} className="text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Giỏ hàng</h2>
                            <p className="text-xs text-slate-500">{items.length} sản phẩm</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                            <div className="bg-slate-100 p-6 rounded-full mb-4">
                                <ShoppingCart size={40} className="text-slate-300" />
                            </div>
                            <p className="text-slate-500 mb-2">Giỏ hàng trống</p>
                            <p className="text-sm text-slate-400">Thêm sản phẩm để bắt đầu</p>
                        </div>
                    ) : (
                        items.map(item => (
                            <div
                                key={`${item.productId}-${item.variant.size}`}
                                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
                            >
                                <div className="flex gap-3">
                                    <img
                                        src={item.productImage}
                                        alt={item.productName}
                                        className="w-16 h-16 rounded-lg object-cover bg-slate-100"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-slate-800 text-sm truncate">
                                            {item.productName}
                                        </h4>
                                        <p className="text-xs text-slate-500 mb-1">
                                            {item.variant.size} | {item.variant.unit}
                                        </p>
                                        <p className="text-sm font-semibold text-primary-600">
                                            {formatter.format(item.variant.price)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => removeFromCart(item.productId, item.variant.size)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors self-start"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Quantity & Subtotal */}
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.variant.size, item.quantity - 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-8 text-center font-medium text-slate-800">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => updateQuantity(item.productId, item.variant.size, item.quantity + 1)}
                                            className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <p className="font-bold text-slate-800">
                                        = {formatter.format(item.variant.price * item.quantity)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t border-slate-200 bg-white p-4 space-y-4">
                        {/* Total */}
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 font-medium">Tổng cộng:</span>
                            <span className="text-2xl font-bold text-primary-600">
                                {formatter.format(getTotalPrice())}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={clearCart}
                                className="px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-sm"
                            >
                                Xóa hết
                            </button>
                            <button
                                onClick={() => setShowOrderSummary(true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
                            >
                                <Send size={18} />
                                <span>Phiếu soạn hàng</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Summary Modal */}
            {showOrderSummary && (
                <OrderSummary onClose={() => setShowOrderSummary(false)} />
            )}
        </>
    );
};
