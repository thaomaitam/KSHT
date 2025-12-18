import React from 'react';
import { Product } from '../types';
import { Tag, ArrowRight } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  // Calculate price range
  const prices = product.variants.map(v => v.price);
  const minPrice = Math.min(...prices);

  const formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  });

  return (
    <div
      className="group bg-white rounded-2xl shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden border border-slate-100 cursor-pointer flex flex-col h-full"
      onClick={() => onClick(product)}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
          loading="lazy"
        />
        {product.isHot && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-10 tracking-widest uppercase">
            Hot
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      <div className="p-4 md:p-5 flex flex-col flex-grow">
        <div className="flex items-center gap-1.5 mb-2">
          <Tag size={12} className="text-primary-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {product.category}
          </span>
        </div>

        <h3 className="text-slate-800 font-bold text-base md:text-lg leading-snug mb-3 group-hover:text-primary-600 transition-colors line-clamp-2">
          {product.name}
        </h3>

        <div className="mt-auto pt-4 flex items-end justify-between border-t border-slate-50">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Giá từ</span>
            <span className="text-primary-600 font-black text-xl md:text-2xl tracking-tight">
              {formatter.format(minPrice).replace('₫', '').trim()}
              <span className="text-sm ml-1">₫</span>
            </span>
          </div>
          <div className="bg-slate-50 text-slate-400 p-2.5 rounded-xl group-hover:bg-primary-600 group-hover:text-white group-hover:rotate-45 transition-all duration-500 shadow-inner">
            <ArrowRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};