import React from 'react';
import { Tag, Search, Filter, Save, AlertCircle } from 'lucide-react';
import { Product } from '../../types';
import { businessService } from '../../businessService';

interface CostPricesTabProps {
    products: Product[];
    costPrices: Record<string, number>;
    setCostPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    handleSaveCostPrices: () => Promise<void>;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const CostPricesTab: React.FC<CostPricesTabProps> = ({
    products, costPrices, setCostPrices, handleSaveCostPrices
}) => {
    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Tag size={20} className="text-emerald-600" />
                        <h2 className="font-semibold text-slate-800">Quản lý giá vốn</h2>
                    </div>
                    <button
                        onClick={handleSaveCostPrices}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <Save size={18} />
                        Lưu thay đổi
                    </button>
                </div>
                <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                    <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                        Giá vốn được sử dụng để tính toán lợi nhuận trong các báo cáo. Vui lòng nhập giá vốn chính xác cho từng loại sản phẩm.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 text-left">Sản phẩm</th>
                                <th className="px-6 py-4 text-left">Phân loại</th>
                                <th className="px-6 py-4 text-right">Giá bán</th>
                                <th className="px-6 py-4 text-right w-48">Giá vốn</th>
                                <th className="px-6 py-4 text-right">Lợi nhuận dự kiến</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(product => (
                                <React.Fragment key={product.id}>
                                    {product.variants.map((variant, vIdx) => {
                                        const variantId = `${product.id}-${variant.name}`;
                                        const costPrice = costPrices[variantId] || 0;
                                        const profit = variant.price - costPrice;
                                        const profitMargin = variant.price > 0 ? (profit / variant.price) * 100 : 0;

                                        return (
                                            <tr key={variantId} className="hover:bg-slate-50/50 transition-colors">
                                                {vIdx === 0 && (
                                                    <td className="px-6 py-4" rowSpan={product.variants.length}>
                                                        <div className="flex items-center gap-3">
                                                            <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                                                            <div className="text-sm font-bold text-slate-800">{product.name}</div>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600">{variant.name}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-sm font-medium text-slate-500">{formatPrice(variant.price)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={costPrice || ''}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                setCostPrices(prev => ({ ...prev, [variantId]: val }));
                                                            }}
                                                            className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-right font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                            placeholder="0"
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">đ</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`text-sm font-bold ${profit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {formatPrice(profit)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                        Biên: {profitMargin.toFixed(1)}%
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
