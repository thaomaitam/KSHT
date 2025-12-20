import React from 'react';
import { Plus } from 'lucide-react';
import { NewOrder, OrderItem } from '../../hooks/useBusinessData';

interface ManualEntryRowProps {
    newOrder: NewOrder;
    setNewOrder: (order: NewOrder) => void;
}

export const ManualEntryRow: React.FC<ManualEntryRowProps> = ({ newOrder, setNewOrder }) => {
    const [name, setName] = React.useState('');
    const [unit, setUnit] = React.useState('');
    const [quantity, setQuantity] = React.useState(0);
    const [soCuon, setSoCuon] = React.useState(0);
    const [soKi, setSoKi] = React.useState(0);
    const [unitPrice, setUnitPrice] = React.useState(0);

    const handleAddItem = () => {
        if (!name.trim()) return;

        const q = Number(quantity) || 0;
        const c = Number(soCuon) || 0;
        const k = Number(soKi) || 0;
        const p = Number(unitPrice) || 0;

        // Automatic formula detection
        let total = 0;
        if (newOrder.showSoCuon && c > 0 && newOrder.showSoKi && k > 0) {
            total = q * c * k * p;
        } else if (newOrder.showSoCuon && c > 0) {
            total = q * c * p;
        } else if (newOrder.showSoKi && k > 0) {
            total = q * k * p;
        } else {
            total = q * p;
        }

        const newItem: OrderItem = {
            id: 'item_' + Date.now(),
            name: name.trim(),
            unit: unit || 'Cây',
            quantity: q,
            soCuon: newOrder.showSoCuon ? c : undefined,
            soKi: newOrder.showSoKi ? k : undefined,
            unitPrice: p,
            total,
            isManual: true
        };

        setNewOrder({
            ...newOrder,
            items: [...newOrder.items, newItem]
        });

        // Reset form
        setName('');
        setUnit('');
        setQuantity(0);
        setSoCuon(0);
        setSoKi(0);
        setUnitPrice(0);
    };

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            {/* Scrollable container for mobile */}
            <div className="overflow-x-auto">
                <div className="flex items-center gap-2 p-3 min-w-[600px]">
                    {/* Tên hàng */}
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tên hàng"
                        className="flex-[2] min-w-[150px] px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    {/* ĐVT */}
                    <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="ĐVT"
                        className="w-16 px-2 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center"
                    />
                    {/* SL */}
                    <input
                        type="number"
                        min="1"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        placeholder="SL"
                        className="w-16 px-2 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center font-medium"
                    />
                    {/* Số cuộn - conditional */}
                    {newOrder.showSoCuon && (
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={soCuon || ''}
                            onChange={(e) => setSoCuon(parseFloat(e.target.value) || 0)}
                            placeholder="Cuộn"
                            className="w-16 px-2 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center"
                        />
                    )}
                    {/* Số kí - conditional */}
                    {newOrder.showSoKi && (
                        <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={soKi || ''}
                            onChange={(e) => setSoKi(parseFloat(e.target.value) || 0)}
                            placeholder="Kí"
                            className="w-16 px-2 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center"
                        />
                    )}
                    {/* Đơn giá */}
                    <input
                        type="number"
                        min="0"
                        value={unitPrice || ''}
                        onChange={(e) => setUnitPrice(parseInt(e.target.value) || 0)}
                        placeholder="Đơn giá"
                        className="w-24 px-2 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-right font-medium"
                    />
                    {/* Nút thêm */}
                    <button
                        onClick={handleAddItem}
                        disabled={!name.trim()}
                        className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 flex-shrink-0"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>
            {/* Mobile Hint */}
            <div className="md:hidden px-3 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-bold text-center uppercase tracking-widest">
                ← Vuốt sang trái để điền đầy đủ →
            </div>
        </div>
    );
};
