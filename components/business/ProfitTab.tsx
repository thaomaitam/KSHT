import React, { useState, useMemo } from 'react';
import { TrendingUp, Search, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import { Order } from '../../businessService';

interface ProfitTabProps {
    orders: Order[];
}

type SortField = 'date' | 'revenue' | 'cost' | 'profit' | 'margin';
type SortOrder = 'asc' | 'desc';

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

interface OrderProfit {
    order: Order;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
}

export const ProfitTab: React.FC<ProfitTabProps> = ({ orders }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Calculate profit for each order
    const orderProfits: OrderProfit[] = useMemo(() => {
        return orders.map(order => {
            const subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
            const revenue = subtotal - (order.discount || 0);
            const cost = order.items.reduce((sum, item) => {
                const q = Number(item.quantity) || 0;
                const c = Number(item.soCuon) || 0;
                const k = Number(item.soKi) || 0;
                const cp = Number(item.costPrice) || 0;

                let itemCost = 0;
                if (c > 0 && k > 0) {
                    itemCost = q * c * k * cp;
                } else if (c > 0) {
                    itemCost = q * c * cp;
                } else if (k > 0) {
                    itemCost = q * k * cp;
                } else {
                    itemCost = q * cp;
                }
                return sum + itemCost;
            }, 0);
            const profit = revenue - cost;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            return { order, revenue, cost, profit, margin };
        });
    }, [orders]);

    // Filter orders
    const filteredOrders = useMemo(() => {
        return orderProfits.filter(op => {
            // Search filter
            const matchSearch = !searchTerm ||
                op.order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                op.order.phone.includes(searchTerm) ||
                op.order.id.includes(searchTerm);

            // Date filter
            const orderDate = new Date(op.order.createdAt);
            const matchDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
            const matchDateTo = !dateTo || orderDate <= new Date(dateTo + 'T23:59:59');

            return matchSearch && matchDateFrom && matchDateTo;
        });
    }, [orderProfits, searchTerm, dateFrom, dateTo]);

    // Sort orders
    const sortedOrders = useMemo(() => {
        return [...filteredOrders].sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'date':
                    comparison = new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime();
                    break;
                case 'revenue':
                    comparison = a.revenue - b.revenue;
                    break;
                case 'cost':
                    comparison = a.cost - b.cost;
                    break;
                case 'profit':
                    comparison = a.profit - b.profit;
                    break;
                case 'margin':
                    comparison = a.margin - b.margin;
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [filteredOrders, sortField, sortOrder]);

    // Calculate totals
    const totals = useMemo(() => {
        return sortedOrders.reduce((acc, op) => ({
            revenue: acc.revenue + op.revenue,
            cost: acc.cost + op.cost,
            profit: acc.profit + op.profit
        }), { revenue: 0, cost: 0, profit: 0 });
    }, [sortedOrders]);

    const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={14} className="text-slate-300" />;
        return sortOrder === 'asc'
            ? <ArrowUp size={14} className="text-green-600" />
            : <ArrowDown size={14} className="text-green-600" />;
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tổng doanh thu</p>
                    <p className="text-xl font-black text-slate-800">{formatPrice(totals.revenue)}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tổng giá vốn</p>
                    <p className="text-xl font-black text-orange-600">{formatPrice(totals.cost)}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tổng lợi nhuận</p>
                    <p className={`text-xl font-black ${totals.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatPrice(totals.profit)}
                    </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Biên lợi nhuận</p>
                    <p className={`text-xl font-black ${totalMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {totalMargin.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Main Table */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <TrendingUp size={20} className="text-green-600" />
                        <h2 className="font-semibold text-slate-800">Lợi nhuận đơn hàng</h2>
                        <span className="text-xs text-slate-400">({sortedOrders.length} đơn)</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm khách hàng, SĐT..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm w-48"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                            />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <tr>
                                <th
                                    className="px-6 py-4 text-left cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-2">
                                        Ngày tạo
                                        <SortIcon field="date" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left">Khách hàng</th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('revenue')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Doanh thu
                                        <SortIcon field="revenue" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('cost')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Giá vốn
                                        <SortIcon field="cost" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('profit')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Lợi nhuận
                                        <SortIcon field="profit" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleSort('margin')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Biên LN
                                        <SortIcon field="margin" />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedOrders.length > 0 ? (
                                sortedOrders.map(({ order, revenue, cost, profit, margin }) => (
                                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-700">{formatDateTime(order.createdAt)}</div>
                                            <div className="text-xs text-slate-400 font-mono">#{order.id.slice(-6).toUpperCase()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-800">{order.customerName}</div>
                                            <div className="text-xs text-slate-500">{order.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-semibold text-slate-700">{formatPrice(revenue)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-sm font-semibold text-orange-600">{formatPrice(cost)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {profit >= 0 ? '+' : ''}{formatPrice(profit)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${margin >= 30 ? 'bg-green-100 text-green-700' :
                                                margin >= 15 ? 'bg-yellow-100 text-yellow-700' :
                                                    margin >= 0 ? 'bg-orange-100 text-orange-700' :
                                                        'bg-red-100 text-red-700'
                                                }`}>
                                                {margin.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <TrendingUp size={40} className="text-slate-200" />
                                            <p>Chưa có dữ liệu lợi nhuận</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
