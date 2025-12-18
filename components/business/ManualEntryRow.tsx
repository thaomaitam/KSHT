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
        <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tên hàng"
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="ĐVT"
                        className="w-20 px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center"
                    />
                    <input
                        type="number"
                        min="1"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        placeholder="SL"
                        className="w-20 px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center font-medium"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {newOrder.showSoCuon && (
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={soCuon || ''}
                        onChange={(e) => setSoCuon(parseFloat(e.target.value) || 0)}
                        placeholder="Số cuộn"
                        className="flex-1 min-w-[80px] px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center"
                    />
                )}
                {newOrder.showSoKi && (
                    <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={soKi || ''}
                        onChange={(e) => setSoKi(parseFloat(e.target.value) || 0)}
                        placeholder="Số kí"
                        className="flex-1 min-w-[80px] px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-center"
                    />
                )}
                <input
                    type="number"
                    min="0"
                    value={unitPrice || ''}
                    onChange={(e) => setUnitPrice(parseInt(e.target.value) || 0)}
                    placeholder="Đơn giá"
                    className="flex-[1.5] min-w-[100px] px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-right font-medium"
                />
                <button
                    onClick={handleAddItem}
                    disabled={!name.trim()}
                    className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                >
                    <Plus size={20} />
                </button>
            </div>
        </div>
    );
};
