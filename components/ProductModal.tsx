import React, { useEffect, useState } from 'react';
import { Product, ProductVariant } from '../types';
import { ZALO_LINK } from '../constants';
import { X, MessageCircle, ShoppingCart, Plus, Check } from 'lucide-react';
import { useCart } from '../CartContext';
import { settingsService } from '../settingsService';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart, items } = useCart();
  const [addedVariant, setAddedVariant] = useState<string | null>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 p-2.5 bg-white/90 hover:bg-white text-slate-400 hover:text-red-500 rounded-2xl transition-all shadow-lg hover:rotate-90"
        >
          <X size={24} />
        </button>

        {/* Image Section */}
        <div className="w-full md:w-1/2 h-72 md:h-auto bg-slate-100 relative shrink-0 group">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          {product.isHot && (
            <div className="absolute top-6 left-6 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl tracking-widest uppercase z-10">
              Hot Item
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col overflow-y-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-lg bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-widest border border-primary-100">
                {product.category}
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
              {product.name}
            </h2>
            <p className="text-slate-500 leading-relaxed text-base">
              {product.description}
            </p>
          </div>

          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden mb-8">
            <div className="grid grid-cols-4 bg-slate-100/50 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100">
              <div>Kích thước</div>
              <div>Đơn vị</div>
              <div>Đơn giá</div>
              <div>Chọn</div>
            </div>
            <div className="max-h-64 overflow-y-auto scrollbar-hide">
              {product.variants.map((variant, index) => {
                const qtyInCart = getQuantityInCart(variant.size);
                const justAdded = addedVariant === variant.size;

                return (
                  <div
                    key={index}
                    className="grid grid-cols-4 p-4 border-b border-slate-50 last:border-0 hover:bg-white transition-all items-center text-center group/item"
                  >
                    <div className="font-bold text-slate-700 text-sm">{variant.size}</div>
                    <div className="text-slate-400 text-xs font-medium">{variant.unit}</div>
                    <div className="font-black text-primary-600 text-base">
                      {formatter.format(variant.price).replace('₫', '').trim()}
                      <span className="text-[10px] ml-0.5">₫</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleAddToCart(variant)}
                        className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 shadow-sm ${justAdded
                          ? 'bg-green-500 text-white scale-110'
                          : 'bg-white text-primary-600 hover:bg-primary-600 hover:text-white border border-slate-100 hover:border-primary-600'
                          }`}
                      >
                        {justAdded ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
                        {qtyInCart > 0 && !justAdded && (
                          <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg animate-in zoom-in">
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

          <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
            <a
              href={settingsService.getZaloLink()}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-3 bg-[#0068ff] hover:bg-[#0056d6] text-white py-4 rounded-2xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-100"
            >
              <MessageCircle size={20} fill="currentColor" />
              <span>NHẮN ZALO TƯ VẤN</span>
            </a>
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('open-cart'));
              }}
              className="flex-1 flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-slate-200"
            >
              <ShoppingCart size={20} />
              <span>XEM GIỎ HÀNG</span>
            </button>
          </div>
          <p className="mt-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            * Giá sỉ tốt nhất thị trường - Giao hàng toàn quốc
          </p>
        </div>
      </div>
    </div>
  );
};