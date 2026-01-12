import React, { useEffect, useState } from 'react';
import { Product, ProductVariant } from '../types';
import { ZALO_LINK } from '../constants';
import { X, MessageCircle, ShoppingCart, Plus, Check, ZoomIn } from 'lucide-react';
import { useCart } from '../CartContext';
import { settingsService } from '../settingsService';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart, items } = useCart();
  const [addedVariant, setAddedVariant] = useState<string | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  useEffect(() => {
    if (product) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [product]);

  if (!product) return null;

  const formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  });

  const handleAddToCart = (variant: ProductVariant) => {
    addToCart(product, variant);
    setAddedVariant(variant.size);
    setTimeout(() => setAddedVariant(null), 1000);
  };

  const getQuantityInCart = (variantSize: string) => {
    const item = items.find(
      i => i.productId === product.id && i.variant.size === variantSize
    );
    return item?.quantity || 0;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Mobile: Full-screen bottom sheet, scrollable | Desktop: Centered modal with 2-column layout */}
      <div
        className="bg-white dark:bg-slate-800 w-full h-[95vh] md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative animate-in slide-in-from-bottom duration-300 md:zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 md:top-5 md:right-5 z-20 p-2 md:p-2.5 bg-white/90 dark:bg-slate-700/90 hover:bg-white dark:hover:bg-slate-600 text-slate-400 dark:text-slate-300 hover:text-red-500 rounded-xl md:rounded-2xl transition-all shadow-lg hover:rotate-90"
        >
          <X size={20} className="md:w-6 md:h-6" />
        </button>

        {/* Mobile: Scrollable container for entire content | Desktop: Side-by-side layout */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden md:flex md:flex-row">
          {/* Image Section - Scrolls with content on mobile, fixed on desktop */}
          <div className="w-full md:w-1/2 aspect-square md:aspect-auto md:h-auto bg-slate-100 dark:bg-slate-700 relative shrink-0 group">
            <img
              src={product.image}
              alt={product.name}
              onClick={() => setIsImageZoomed(true)}
              className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105 cursor-zoom-in"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
            {/* Zoom hint button */}
            <button
              onClick={() => setIsImageZoomed(true)}
              className="absolute bottom-4 right-4 p-2 bg-white/90 dark:bg-slate-700/90 hover:bg-white dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl shadow-lg transition-all hover:scale-110 z-10"
              title="Phóng to ảnh"
            >
              <ZoomIn size={20} />
            </button>
            {product.isHot && (
              <div className="absolute top-4 left-4 md:top-6 md:left-6 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-black px-3 md:px-4 py-1 md:py-1.5 rounded-full shadow-xl tracking-widest uppercase z-10">
                Hot Item
              </div>
            )}
          </div>

          {/* Fullscreen Image Zoom Overlay */}
          {isImageZoomed && (
            <div
              className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200"
              onClick={() => setIsImageZoomed(false)}
            >
              <button
                onClick={() => setIsImageZoomed(false)}
                className="absolute top-4 right-4 z-20 p-3 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
              >
                <X size={24} />
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
                Chạm vào để đóng • Pinch để zoom
              </p>
              <img
                src={product.image}
                alt={product.name}
                className="max-w-[95vw] max-h-[90vh] object-contain touch-pinch-zoom"
                style={{ touchAction: 'pinch-zoom' }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Content Section */}
          <div className="w-full md:w-1/2 p-4 md:p-10 flex flex-col md:overflow-y-auto">
            {/* Product Info */}
            <div className="mb-4 md:mb-8">
              <div className="flex items-center gap-2 mb-2 md:mb-4">
                <span className="px-2 md:px-3 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-primary-100 dark:border-primary-800">
                  {product.category}
                </span>
              </div>
              <h2 className="text-xl md:text-4xl font-black text-slate-900 dark:text-slate-100 mb-2 md:mb-4 tracking-tight leading-tight">
                {product.name}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm md:text-base">
                {product.description}
              </p>
            </div>

            {/* Variants Table */}
            <div className="bg-slate-50/50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 overflow-hidden mb-4 md:mb-8">
              <div className="grid grid-cols-4 bg-slate-100/50 dark:bg-slate-600/50 p-2 md:p-4 text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-wider text-center border-b border-slate-100 dark:border-slate-600">
                <div>Kích thước</div>
                <div>ĐVT</div>
                <div>Đơn giá</div>
                <div>Chọn</div>
              </div>
              <div className="md:max-h-[30vh] md:overflow-y-auto">
                {product.variants.map((variant, index) => {
                  const qtyInCart = getQuantityInCart(variant.size);
                  const justAdded = addedVariant === variant.size;

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-4 p-2 md:p-4 border-b border-slate-50 dark:border-slate-600 last:border-0 hover:bg-white dark:hover:bg-slate-600 transition-all items-center text-center group/item"
                    >
                      <div className="font-bold text-slate-700 dark:text-slate-200 text-xs md:text-sm truncate px-1">{variant.size}</div>
                      <div className="text-slate-400 dark:text-slate-400 text-[10px] md:text-xs font-medium">{variant.unit}</div>
                      <div className="font-black text-primary-600 dark:text-primary-400 text-sm md:text-base">
                        {formatter.format(variant.price).replace('₫', '').trim()}
                        <span className="text-[10px] ml-0.5">₫</span>
                      </div>
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleAddToCart(variant)}
                          className={`relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-xl transition-all duration-300 shadow-sm ${justAdded
                            ? 'bg-green-500 text-white scale-110'
                            : 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 hover:bg-primary-600 hover:text-white border border-slate-100 dark:border-slate-500 hover:border-primary-600'
                            }`}
                        >
                          {justAdded ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
                          {qtyInCart > 0 && !justAdded && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-[9px] md:text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg animate-in zoom-in">
                              {qtyInCart}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons - Icon only on mobile, full text on sm+ */}
            <div className="mt-auto pt-4 md:pt-6 border-t border-slate-100 dark:border-slate-600 flex gap-3 md:gap-4">
              <a
                href={settingsService.getZaloLink()}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-[#0068ff] hover:bg-[#0056d6] text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-100 dark:shadow-blue-900/30"
                title="Nhắn Zalo tư vấn"
              >
                <MessageCircle size={20} fill="currentColor" />
                <span className="hidden sm:inline">NHẮN ZALO TƯ VẤN</span>
              </a>
              <button
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('open-cart'));
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-xs md:text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-slate-200 dark:shadow-slate-900/30"
                title="Xem giỏ hàng"
              >
                <ShoppingCart size={20} />
                <span className="hidden sm:inline">XEM GIỎ HÀNG</span>
              </button>
            </div>
            <p className="mt-3 md:mt-4 text-center text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              * Giá sỉ tốt nhất thị trường - Giao hàng toàn quốc
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};