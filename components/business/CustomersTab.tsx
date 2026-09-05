import React from 'react';
import { Users, Search, Phone, Trash2, FilePlus } from 'lucide-react';
import { Customer, businessService } from '../../businessService';
import { NoticeBanner } from '../NoticeBanner';

interface CustomersTabProps {
    customers: Customer[];
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
    customerSearch: string;
    setCustomerSearch: (search: string) => void;
    onCreateOrder: (customer: Customer) => void;
    truncated?: boolean;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const CustomersTab: React.FC<CustomersTabProps> = ({
    customers, setCustomers, customerSearch, setCustomerSearch, onCreateOrder, truncated,
}) => {
    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        customer.phone.includes(customerSearch)
    );

    const handleDeleteCustomer = async (customerId: string) => {
        if (!window.confirm('Lưu trữ khách hàng này trên máy chủ?')) return;
        try {
            const next = await businessService.deleteCustomer(customerId);
            setCustomers(next.items);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không xóa được khách hàng.');
        }
    };

    return (
        <div className="space-y-6">
            {truncated && (
                <NoticeBanner
                    kind="warning"
                    title="Danh sách khách bị cắt"
                    message="Danh sách khách hoặc phải thu chưa tải đủ trang. Số phải thu từng khách có thể thiếu."
                />
            )}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Users size={20} className="text-purple-600" />
                        <h2 className="font-semibold text-slate-800">Danh sách khách hàng</h2>
                    </div>
                    <div className="relative">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm theo tên, SĐT..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm w-64"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 text-left">Khách hàng</th>
                                <th className="px-6 py-4 text-left">Liên hệ (đã che)</th>
                                <th className="px-6 py-4 text-right">Phải thu</th>
                                <th className="px-6 py-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCustomers.length > 0 ? (
                                filteredCustomers.map(customer => (
                                    <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-slate-800">{customer.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{customer.id}</div>
                                            {customer.duplicatePhoneWarning && (
                                                <div className="text-[10px] text-amber-600 font-bold mt-1">Trùng SĐT</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Phone size={14} className="text-slate-400" />
                                                {customer.phone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`text-sm font-bold ${(customer.outstanding || 0) > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                                {formatPrice(customer.outstanding || 0)}
                                            </div>
                                            {!customer.outstandingComplete && (
                                                <div className="text-[10px] text-amber-600">Không đủ trang phải thu</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => onCreateOrder(customer)}
                                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Tạo đơn mới"
                                                >
                                                    <FilePlus size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCustomer(customer.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Lưu trữ khách"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <Users size={40} className="text-slate-200" />
                                            <p>Chưa có khách hàng nào</p>
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
