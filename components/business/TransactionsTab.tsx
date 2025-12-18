import React from 'react';
import { CreditCard, Search, Filter, Plus, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Transaction, businessService } from '../../businessService';

interface TransactionsTabProps {
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    transactionSearch: string;
    setTransactionSearch: (search: string) => void;
    showTransactionModal: boolean;
    setShowTransactionModal: (show: boolean) => void;
    newTransaction: any;
    setNewTransaction: (transaction: any) => void;
    handleAddTransaction: () => Promise<void>;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
    transactions, setTransactions, transactionSearch, setTransactionSearch,
    showTransactionModal, setShowTransactionModal, newTransaction,
    setNewTransaction, handleAddTransaction
}) => {

    const filteredTransactions = transactions.filter(t =>
        t.description.toLowerCase().includes(transactionSearch.toLowerCase()) ||
        t.category.toLowerCase().includes(transactionSearch.toLowerCase())
    );

    const handleDeleteTransaction = async (id: string) => {
        if (window.confirm('Xóa giao dịch này?')) {
            const updated = await businessService.deleteTransaction(id);
            setTransactions(updated);
        }
    };

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <CreditCard size={20} className="text-orange-600" />
                        <h2 className="font-semibold text-slate-800">Sổ thu chi</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm giao dịch..."
                                value={transactionSearch}
                                onChange={(e) => setTransactionSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm w-64"
                            />
                        </div>
                        <button
                            onClick={() => setShowTransactionModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm"
                        >
                            <Plus size={18} />
                            Thêm thu chi
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 text-left">Ngày</th>
                                <th className="px-6 py-4 text-left">Nội dung</th>
                                <th className="px-6 py-4 text-left">Phân loại</th>
                                <th className="px-6 py-4 text-right">Số tiền</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {formatDate(t.date)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-800">{t.description}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`flex items-center justify-end gap-1 text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                                                {t.type === 'income' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                                {formatPrice(t.amount)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteTransaction(t.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <CreditCard size={40} className="text-slate-200" />
                                            <p>Chưa có giao dịch nào</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Transaction Modal */}
            {showTransactionModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Thêm giao dịch mới</h3>
                            <button
                                onClick={() => setShowTransactionModal(false)}
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <Plus size={20} className="rotate-45 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setNewTransaction({ ...newTransaction, type: 'income' })}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTransaction.type === 'income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Thu nhập
                                </button>
                                <button
                                    onClick={() => setNewTransaction({ ...newTransaction, type: 'expense' })}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${newTransaction.type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500'}`}
                                >
                                    Chi phí
                                </button>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Số tiền</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={newTransaction.amount || ''}
                                    onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-lg"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nội dung</label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: Tiền hàng, Tiền điện..."
                                    value={newTransaction.description}
                                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phân loại</label>
                                <select
                                    value={newTransaction.category}
                                    onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                >
                                    <option value="Bán hàng">Bán hàng</option>
                                    <option value="Nhập hàng">Nhập hàng</option>
                                    <option value="Vận chuyển">Vận chuyển</option>
                                    <option value="Mặt bằng">Mặt bằng</option>
                                    <option value="Điện nước">Điện nước</option>
                                    <option value="Khác">Khác</option>
                                </select>
                            </div>
                            <button
                                onClick={handleAddTransaction}
                                className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 mt-2"
                            >
                                Lưu giao dịch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
