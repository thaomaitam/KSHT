import React from 'react';
import { CreditCard, Save } from 'lucide-react';
import { BankInfo } from '../../businessService';

interface BankSettingsProps {
    bankInfo: BankInfo;
    setBankInfo: (info: BankInfo) => void;
    taxRate: number;
    setTaxRate: (rate: number) => void;
    handleSaveBankInfo: () => Promise<void>;
    bankSaveSuccess: boolean;
}

export const BankSettings: React.FC<BankSettingsProps> = ({
    bankInfo, setBankInfo, taxRate, setTaxRate, handleSaveBankInfo, bankSaveSuccess
}) => {
    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <CreditCard size={20} className="text-primary-600" />
                <h2 className="font-semibold text-slate-800">Thông tin ngân hàng</h2>
            </div>
            <div className="p-6">
                <p className="text-sm text-slate-500 mb-4">
                    Thông tin này sẽ hiển thị trong đơn hàng xuất PDF để khách chuyển khoản
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tên ngân hàng</label>
                        <input
                            type="text"
                            value={bankInfo.bankName}
                            onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="SACOMBANK"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Số tài khoản</label>
                        <input
                            type="text"
                            value={bankInfo.accountNumber}
                            onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="050122554391"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Chủ tài khoản</label>
                        <input
                            type="text"
                            value={bankInfo.accountName}
                            onChange={(e) => setBankInfo({ ...bankInfo, accountName: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="NGUYEN THANH HUY"
                        />
                    </div>
                </div>
                <div className="flex items-end gap-4">
                    <div className="w-32">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Thuế mặc định (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={taxRate}
                            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="1.5"
                        />
                    </div>
                    <button
                        onClick={handleSaveBankInfo}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${bankSaveSuccess
                            ? 'bg-green-500 text-white'
                            : 'bg-primary-600 hover:bg-primary-700 text-white'
                            }`}
                    >
                        <Save size={18} />
                        <span>{bankSaveSuccess ? 'Đã lưu!' : 'Lưu'}</span>
                    </button>
                </div>
            </div>
        </section>
    );
};
