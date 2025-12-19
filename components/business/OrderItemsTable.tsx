import React from 'react';
import { Trash2 } from 'lucide-react';
import { OrderItem } from '../../hooks/useBusinessData';

interface OrderItemsTableProps {
    items: OrderItem[];
    updateItemField: (itemId: string, field: keyof OrderItem, value: string | number) => void;
    removeItem: (itemId: string) => void;
    hasSoCuon: boolean;
    hasSoKi: boolean;
    formatPrice: (price: number) => string;
}

export const OrderItemsTable: React.FC<OrderItemsTableProps> = ({
    items,
    updateItemField,
    removeItem,
    hasSoCuon,
    hasSoKi,
    formatPrice
}) => {
    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] md:min-w-full">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                        <tr>
                            <th className="px-4 py-4 text-left">Sản phẩm</th>
                            <th className="px-2 py-4 text-center w-20">ĐVT</th>
                            <th className="px-2 py-4 text-center w-16">SL</th>
                            {hasSoCuon && (
                                <th className="px-2 py-4 text-center w-20">Số cuộn</th>
                            )}
                            {hasSoKi && (
                                <th className="px-2 py-4 text-center w-20">Số kí</th>
                            )}
                            <th className="px-2 py-4 text-right w-28">Đơn giá</th>
                            <th className="px-4 py-4 text-right w-32">Thành tiền</th>
                            <th className="px-2 py-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map(item => (
                            <tr key={item.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="min-w-[150px]">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                                            className="w-full px-2 py-1.5 border border-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent text-sm font-medium"
                                            placeholder="Tên sản phẩm"
                                        />
                                        {item.isManual && (
                                            <span className="text-[10px] text-orange-500 font-bold mt-1 inline-block uppercase tracking-wider">Nhập tay</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-2 py-3">
                                    <input
                                        type="text"
                                        value={item.unit}
                                        onChange={(e) => updateItemField(item.id, 'unit', e.target.value)}
                                        className="w-full px-1 py-1.5 border border-slate-100 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent text-sm"
                                        placeholder="ĐVT"
                                    />
                                </td>
                                <td className="px-2 py-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.quantity || ''}
                                        onChange={(e) => updateItemField(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                        className="w-full px-1 py-1.5 border border-slate-100 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent text-sm"
                                    />
                                </td>
                                {hasSoCuon && (
                                    <td className="px-2 py-3">
                                        {item.soCuon !== undefined && (
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={item.soCuon || ''}
                                                onChange={(e) => updateItemField(item.id, 'soCuon' as keyof OrderItem, parseFloat(e.target.value) || 0)}
                                                className="w-full px-1 py-1.5 border border-slate-100 rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent text-sm"
                                            />
                                        )}
                                    </td>
                                )}
                                {hasSoKi && (
                                    <td className="px-2 py-3">
                                        {item.soKi !== undefined && (
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={item.soKi || ''}
                                                onChange={(e) => updateItemField(item.id, 'soKi' as keyof OrderItem, parseFloat(e.target.value) || 0)}
                                                className="w-full px-1 py-1.5 border border-slate-100 rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent text-sm"
                                            />
                                        )}
                                    </td>
                                )}
                                <td className="px-2 py-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.unitPrice}
                                        onChange={(e) => updateItemField(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                                        className="w-full px-1 py-1.5 border border-slate-100 rounded-lg text-right font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent text-sm"
                                    />
                                </td>
                                <td className="px-4 py-3 text-right font-black text-slate-700 text-sm">
                                    {formatPrice(item.total)}
                                </td>
                                <td className="px-2 py-3 text-center">
                                    <button
                                        onClick={() => removeItem(item.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Mobile Hint */}
            <div className="md:hidden px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">
                Vuốt sang trái để xem đầy đủ thông tin
            </div>
        </div>
    );
};
