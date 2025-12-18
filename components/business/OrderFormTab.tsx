import React from 'react';
import { FileText, Search, Plus, Trash2, Printer, Check, ChevronDown } from 'lucide-react';
import { Product } from '../../types';
import { Order, BankInfo, businessService } from '../../businessService';
import { NewOrder, OrderItem } from '../../hooks/useBusinessData';
import { generatePDFContent } from '../../utils/pdfGenerator';

interface OrderFormTabProps {
    newOrder: NewOrder;
    setNewOrder: (order: NewOrder) => void;
    productSearch: string;
    setProductSearch: (search: string) => void;
    showProductDropdown: boolean;
    setShowProductDropdown: (show: boolean) => void;
    filteredProducts: Product[];
    addProductFromList: (product: Product) => void;
    addQuantity: number;
    setAddQuantity: (qty: number) => void;
    updateItemField: (itemId: string, field: keyof OrderItem, value: string | number) => void;
    removeItem: (itemId: string) => void;
    getSubtotal: () => number;
    getTotal: () => number;
    handleSaveOrder: () => Promise<Order | null>;
    bankInfo: BankInfo | null;
    orderCount: number;
    resetOrderForm: () => void;
    updateCustomer: (order: Order) => Promise<void>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    productDropdownRef: React.RefObject<HTMLDivElement>;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const OrderFormTab: React.FC<OrderFormTabProps> = ({
    newOrder, setNewOrder, productSearch, setProductSearch,
    showProductDropdown, setShowProductDropdown, filteredProducts,
    addProductFromList, addQuantity, setAddQuantity,
    updateItemField, removeItem, getSubtotal, getTotal,
    handleSaveOrder, bankInfo, orderCount, resetOrderForm,
    updateCustomer, setOrders, productDropdownRef
}) => {

    const handleCreateAndExportPDF = async () => {
        if (!newOrder.customerName.trim()) {
            alert('Vui lòng nhập tên khách hàng');
            return;
        }
        if (newOrder.items.length === 0) {
            alert('Vui lòng thêm ít nhất 1 sản phẩm');
            return;
        }

        const order: Order = {
            id: 'order_' + Date.now(),
            customerName: newOrder.customerName,
            phone: newOrder.phone,
            address: newOrder.address,
            items: newOrder.items,
            total: getTotal(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            paymentMethod: 'cod',
            note: newOrder.note,
            shippingFee: newOrder.shippingFee,
            discount: newOrder.discount,
            debt: newOrder.debt
        };

        const pdfContent = generatePDFContent(order, bankInfo, orderCount + 1);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(pdfContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }

        const updatedOrders = await businessService.addOrder(order);
        setOrders(updatedOrders);
        await updateCustomer(order);
        resetOrderForm();
    };

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                    <FileText size={20} className="text-green-600" />
                    <h2 className="font-semibold text-slate-800">Tạo đơn hàng mới</h2>
                </div>
                <div className="p-6 space-y-6">
                    {/* Customer Info */}
                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                        <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            Thông tin khách hàng
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input
                                type="text"
                                placeholder="Tên khách hàng *"
                                value={newOrder.customerName}
                                onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                                className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            />
                            <input
                                type="tel"
                                placeholder="Số điện thoại"
                                value={newOrder.phone}
                                onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                                className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            />
                            <input
                                type="text"
                                placeholder="Địa chỉ"
                                value={newOrder.address}
                                onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                                className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            />
                        </div>
                    </div>

                    {/* Add Products */}
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-slate-700 flex items-center gap-2">
                                <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                Thêm sản phẩm
                            </h3>
                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={newOrder.isManualEntry}
                                    onChange={(e) => setNewOrder({ ...newOrder, isManualEntry: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-slate-600 font-medium">Nhập tay (không có trong DS)</span>
                            </label>
                        </div>

                        {!newOrder.isManualEntry ? (
                            <div className="flex flex-col md:flex-row gap-4 items-center" ref={productDropdownRef}>
                                <div className="flex-1 w-full relative">
                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm sản phẩm..."
                                        value={productSearch}
                                        onChange={(e) => {
                                            setProductSearch(e.target.value);
                                            setShowProductDropdown(true);
                                        }}
                                        onFocus={() => setShowProductDropdown(true)}
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    />
                                    {showProductDropdown && productSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-80 overflow-auto">
                                            {filteredProducts.length > 0 ? (
                                                filteredProducts.map(product => (
                                                    <button
                                                        key={product.id}
                                                        onClick={() => addProductFromList(product)}
                                                        className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100 last:border-0"
                                                    >
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-medium text-slate-800">{product.name}</div>
                                                            <div className="text-xs text-slate-500">
                                                                {product.variants.length} loại • từ {formatPrice(Math.min(...product.variants.map(v => v.price)))}
                                                            </div>
                                                        </div>
                                                        <ChevronDown size={16} className="text-slate-400" />
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-slate-500">Không tìm thấy sản phẩm</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 bg-white px-4 py-2 border border-slate-200 rounded-xl">
                                    <span className="text-sm font-medium text-slate-500">SL:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={addQuantity}
                                        onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                                        className="w-16 py-1 text-center font-bold text-slate-800 focus:outline-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    const newItem: OrderItem = {
                                        id: 'item_' + Date.now(),
                                        name: '',
                                        unit: 'Cây',
                                        quantity: 1,
                                        unitPrice: 0,
                                        total: 0
                                    };
                                    setNewOrder({
                                        ...newOrder,
                                        items: [...newOrder.items, newItem]
                                    });
                                }}
                                className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                <Plus size={18} />
                                Thêm dòng mới
                            </button>
                        )}
                    </div>

                    {/* Order Items List */}
                    {newOrder.items.length > 0 && (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider font-semibold text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Sản phẩm</th>
                                        <th className="px-4 py-4 text-center w-24">ĐVT</th>
                                        <th className="px-4 py-4 text-center w-20">SL</th>
                                        <th className="px-4 py-4 text-right w-32">Đơn giá</th>
                                        <th className="px-4 py-4 text-right w-32">Thành tiền</th>
                                        <th className="px-4 py-4 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {newOrder.items.map(item => (
                                        <tr key={item.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                    placeholder="Tên sản phẩm"
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(e) => updateItemField(item.id, 'unit', e.target.value)}
                                                    className="w-full px-2 py-2 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                    placeholder="ĐVT"
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemField(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                    className="w-full px-2 py-2 border border-slate-200 rounded-lg text-center font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                />
                                            </td>
                                            <td className="px-4 py-4">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItemField(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                                                    className="w-full px-2 py-2 border border-slate-200 rounded-lg text-right font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent"
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-right font-bold text-slate-700">
                                                {formatPrice(item.total)}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Order Summary & Actions */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
                        <div className="lg:col-span-8 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="font-medium">Tạm tính:</span>
                                        <span className="font-bold text-slate-800">{formatPrice(getSubtotal())}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="font-medium text-slate-600">Phí vận chuyển:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newOrder.shippingFee || ''}
                                            onChange={(e) => setNewOrder({ ...newOrder, shippingFee: parseInt(e.target.value) || 0 })}
                                            className="w-32 px-4 py-2 border border-slate-200 rounded-xl text-right font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="font-medium text-slate-600">Chiết khấu:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newOrder.discount || ''}
                                            onChange={(e) => setNewOrder({ ...newOrder, discount: parseInt(e.target.value) || 0 })}
                                            className="w-32 px-4 py-2 border border-slate-200 rounded-xl text-right font-bold text-red-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="font-medium text-slate-600">Công nợ:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={newOrder.debt || ''}
                                            onChange={(e) => setNewOrder({ ...newOrder, debt: parseInt(e.target.value) || 0 })}
                                            className="w-32 px-4 py-2 border border-slate-200 rounded-xl text-right font-bold text-orange-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                        <span className="text-lg font-bold text-slate-800">Tổng cộng:</span>
                                        <span className="text-2xl font-black text-emerald-600">{formatPrice(getTotal())}</span>
                                    </div>
                                </div>
                                <div className="hidden md:block w-px h-24 bg-slate-100"></div>
                                <div className="flex-1">
                                    <textarea
                                        placeholder="Ghi chú đơn hàng..."
                                        value={newOrder.note}
                                        onChange={(e) => setNewOrder({ ...newOrder, note: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-32 bg-slate-50/30"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
                            <button
                                onClick={handleCreateAndExportPDF}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 active:scale-95"
                            >
                                <Printer size={20} />
                                Tạo đơn & Xuất PDF
                            </button>
                            <button
                                onClick={() => handleSaveOrder()}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-emerald-100 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all active:scale-95"
                            >
                                <Check size={20} />
                                Lưu đơn
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
