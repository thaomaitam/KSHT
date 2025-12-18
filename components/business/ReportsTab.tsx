import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users as UsersIcon, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Order, Transaction, Customer } from '../../businessService';

interface ReportsTabProps {
    orders: Order[];
    transactions: Transaction[];
    customers: Customer[];
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const ReportsTab: React.FC<ReportsTabProps> = ({ orders = [], transactions = [], customers = [] }) => {
    const totalRevenue = (orders || []).reduce((sum, order) => sum + (order.total || 0), 0);
    const totalIncome = (transactions || []).filter(t => t?.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpense = (transactions || []).filter(t => t?.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalDebt = (customers || []).reduce((sum, c) => sum + (c.debt || 0), 0);

    // Calculate real profit from orders
    const totalCost = (orders || []).reduce((sum, order) => {
        const orderCost = (order.items || []).reduce((iSum, item) => {
            const q = Number(item.quantity) || 0;
            const c = Number(item.soCuon) || 0;
            const k = Number(item.soKi) || 0;
            const cp = Number(item.costPrice) || 0;

            if (c > 0 && k > 0) return iSum + (q * c * k * cp);
            if (c > 0) return iSum + (q * c * cp);
            if (k > 0) return iSum + (q * k * cp);
            return iSum + (q * cp);
        }, 0);
        return sum + orderCost;
    }, 0);

    const estimatedProfit = totalRevenue - totalCost;

    // Calculate last 7 days revenue for chart
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const chartData = last7Days.map(date => {
        const dayRevenue = (orders || [])
            .filter(o => {
                if (!o.createdAt) return false;
                const oDate = new Date(o.createdAt);
                oDate.setHours(0, 0, 0, 0);
                return oDate.getTime() === date.getTime();
            })
            .reduce((sum, o) => sum + (o.total || 0), 0);
        return dayRevenue;
    });

    const maxRevenue = Math.max(...chartData, 1);
    const incomeRatio = totalIncome + totalExpense > 0
        ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100)
        : 0;
    const expenseRatio = 100 - incomeRatio;

    const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Doanh thu bán hàng</div>
                        <div className="text-2xl font-black text-slate-800 mt-1">{formatPrice(totalRevenue)}</div>
                        <div className="flex items-center gap-1 text-xs text-green-600 font-bold mt-2">
                            <TrendingUp size={14} />
                            <span>{orders.length} đơn hàng</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                        <ArrowDownLeft size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Tổng thu (Sổ quỹ)</div>
                        <div className="text-2xl font-black text-slate-800 mt-1">{formatPrice(totalIncome)}</div>
                        <div className="flex items-center gap-1 text-xs text-green-600 font-bold mt-2">
                            <TrendingUp size={14} />
                            <span>Dòng tiền vào</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Tổng chi (Sổ quỹ)</div>
                        <div className="text-2xl font-black text-slate-800 mt-1">{formatPrice(totalExpense)}</div>
                        <div className="flex items-center gap-1 text-xs text-red-500 font-bold mt-2">
                            <TrendingDown size={14} />
                            <span>Dòng tiền ra</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Tổng công nợ</div>
                        <div className="text-2xl font-black text-slate-800 mt-1">{formatPrice(totalDebt)}</div>
                        <div className="flex items-center gap-1 text-xs text-orange-500 font-bold mt-2">
                            <UsersIcon size={14} />
                            <span>Từ {customers.filter(c => c.debt > 0).length} khách hàng</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 size={20} className="text-blue-600" />
                            Doanh thu 7 ngày qua
                        </h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg">Theo ngày</span>
                        </div>
                    </div>
                    <div className="h-64 flex items-end justify-between gap-4 px-4">
                        {chartData.map((val, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3">
                                <div
                                    className="w-full bg-blue-500 rounded-t-xl hover:bg-blue-600 transition-all cursor-pointer relative group"
                                    style={{ height: `${(val / maxRevenue) * 100}%`, minHeight: val > 0 ? '4px' : '0' }}
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                                        {formatPrice(val)}
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                    {daysOfWeek[last7Days[i].getDay()]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                        <h3 className="font-bold text-blue-400 mb-6">Lợi nhuận gộp</h3>
                        <div className="text-4xl font-black mb-2">{formatPrice(estimatedProfit)}</div>
                        <p className="text-slate-400 text-sm">Ước tính từ đơn hàng</p>

                        <div className="mt-12 space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">
                                        <ArrowDownLeft size={16} />
                                    </div>
                                    <span className="text-sm font-medium">Tỷ lệ thu</span>
                                </div>
                                <span className="font-bold">{incomeRatio}%</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                                        <ArrowUpRight size={16} />
                                    </div>
                                    <span className="text-sm font-medium">Tỷ lệ chi</span>
                                </div>
                                <span className="font-bold">{expenseRatio}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
