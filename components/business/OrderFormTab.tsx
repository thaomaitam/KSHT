import React from 'react';
import html2canvas from 'html2canvas';
import { FileText, Search, Plus, ChevronDown, Store } from 'lucide-react';
import { Product } from '../../types';
import { Order, BankInfo, ShopTemplate, businessService } from '../../businessService';
import { NewOrder, OrderItem } from '../../hooks/useBusinessData';
import { generatePDFContent, generateReceiptContent } from '../../utils/pdfGenerator';
import { ManualEntryRow } from './ManualEntryRow';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderSummarySection } from './OrderSummarySection';

interface OrderFormTabProps {
    newOrder: NewOrder;
    setNewOrder: (order: NewOrder) => void;
    productSearch: string;
    setProductSearch: (search: string) => void;
    showProductDropdown: boolean;
    setShowProductDropdown: (show: boolean) => void;
    filteredProducts: Product[];
    addProductFromList: (product: Product) => void;
    addVariantToOrder: (product: Product, variant: import('../../types').ProductVariant) => void;
    addQuantity: number;
    setAddQuantity: (qty: number) => void;
    updateItemField: (itemId: string, field: keyof OrderItem, value: string | number) => void;
    removeItem: (itemId: string) => void;
    getSubtotal: () => number;
    getTotal: () => number;
    handleSaveOrder: () => Promise<Order | null>;
    bankInfo: BankInfo | null;
    shopTemplates: ShopTemplate[];
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
    addProductFromList, addVariantToOrder, addQuantity, setAddQuantity,
    updateItemField, removeItem, getSubtotal, getTotal,
    handleSaveOrder, bankInfo, shopTemplates, orderCount, resetOrderForm,
    updateCustomer, setOrders, productDropdownRef
}) => {
    const [expandedProductId, setExpandedProductId] = React.useState<string | null>(null);
    const hasSoCuonInTable = newOrder.items.some(item => item.soCuon !== undefined && item.soCuon > 0);
    const hasSoKiInTable = newOrder.items.some(item => item.soKi !== undefined && item.soKi > 0);

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

        const selectedTemplate = shopTemplates.find(t => t.id === newOrder.selectedTemplateId) || shopTemplates[0];
        const pdfContent = generatePDFContent(order, bankInfo, orderCount + 1, selectedTemplate);

        // Create hidden container to render the invoice HTML
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 800px; background: white;';
        container.innerHTML = pdfContent;
        document.body.appendChild(container);

        // Find the actual content container inside the HTML
        const contentElement = container.querySelector('.container') as HTMLElement;
        if (!contentElement) {
            document.body.removeChild(container);
            alert('Lỗi: Không thể tạo ảnh hoá đơn');
            return;
        }

        // Wait for fonts and images to load
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Convert HTML to PNG using html2canvas
            const canvas = await html2canvas(contentElement, {
                backgroundColor: '#ffffff',
                scale: 2, // Higher quality
                useCORS: true,
                logging: false,
                width: contentElement.scrollWidth,
                height: contentElement.scrollHeight
            });

            const imageDataUrl = canvas.toDataURL('image/png');

            // Clean up hidden container
            document.body.removeChild(container);

            // Open new window with the image
            const imageWindow = window.open('', '_blank');
            if (imageWindow) {
                imageWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Đơn hàng #${orderCount + 1}</title>
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body { 
                                background: #1a1a2e; 
                                min-height: 100vh; 
                                display: flex; 
                                flex-direction: column;
                                align-items: center; 
                                padding: 20px;
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            }
                            .toolbar {
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                display: flex;
                                gap: 10px;
                                z-index: 100;
                            }
                            .btn {
                                padding: 12px 24px;
                                border: none;
                                border-radius: 8px;
                                font-size: 14px;
                                font-weight: 600;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                transition: all 0.2s;
                            }
                            .btn-print {
                                background: #4CAF50;
                                color: white;
                            }
                            .btn-print:hover { background: #45a049; }
                            .hint {
                                position: fixed;
                                bottom: 20px;
                                left: 50%;
                                transform: translateX(-50%);
                                background: rgba(255,255,255,0.9);
                                padding: 12px 24px;
                                border-radius: 8px;
                                font-size: 13px;
                                color: #333;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            }
                            .invoice-image {
                                max-width: 100%;
                                height: auto;
                                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                                border-radius: 8px;
                                margin-top: 20px;
                            }
                            @media print {
                                body { background: white; padding: 0; }
                                .toolbar, .hint { display: none !important; }
                                .invoice-image { 
                                    box-shadow: none; 
                                    border-radius: 0;
                                    max-width: 100%;
                                    margin: 0;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="toolbar">
                            <button class="btn btn-print" onclick="window.print()">
                                🖨️ In PDF
                            </button>
                        </div>
                        <img src="${imageDataUrl}" alt="Hoá đơn" class="invoice-image" />
                        <div class="hint">
                            💡 <strong>Tip:</strong> Chuột phải vào ảnh → Sao chép hình ảnh để gửi khách qua Zalo/Messenger
                        </div>
                    </body>
                    </html>
                `);
                imageWindow.document.close();
            }

            // Save order to database
            const updatedOrders = await businessService.addOrder(order);
            setOrders(updatedOrders);
            await updateCustomer(order);
            resetOrderForm();

        } catch (error) {
            console.error('Error generating invoice image:', error);
            document.body.removeChild(container);

            // Fallback to old PDF method
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
        }
    };

    const handleThermalPrint = async () => {
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

        const selectedTemplate = shopTemplates.find(t => t.id === newOrder.selectedTemplateId) || shopTemplates[0];
        const receiptContent = generateReceiptContent(order, orderCount + 1, selectedTemplate, bankInfo);

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        }

        // Save order to database
        const updatedOrders = await businessService.addOrder(order);
        setOrders(updatedOrders);
        await updateCustomer(order);
        resetOrderForm();
    };

    return (
        <div className="space-y-6">
            {/* Template Selection */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <Store size={20} className="text-pink-500" />
                    <span className="text-sm">Mẫu in hóa đơn:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {shopTemplates.map(template => (
                        <button
                            key={template.id}
                            onClick={() => setNewOrder({ ...newOrder, selectedTemplateId: template.id })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${newOrder.selectedTemplateId === template.id
                                ? 'border-pink-500 bg-pink-50 text-pink-600'
                                : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                }`}
                        >
                            {template.name}
                        </button>
                    ))}
                </div>
            </div>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                    <FileText size={20} className="text-green-600" />
                    <h2 className="font-semibold text-slate-800">Tạo đơn hàng mới</h2>
                </div>
                <div className="p-4 md:p-6 space-y-6">
                    {/* Customer Info */}
                    <div className="bg-slate-50/80 p-4 md:p-5 rounded-2xl border border-slate-100">
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
                                className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                            />
                            <input
                                type="tel"
                                placeholder="Số điện thoại"
                                value={newOrder.phone}
                                onChange={(e) => setNewOrder({ ...newOrder, phone: e.target.value })}
                                className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Địa chỉ"
                                value={newOrder.address}
                                onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })}
                                className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-sm"
                            />
                        </div>
                    </div>

                    {/* Add Products */}
                    <div className="bg-emerald-50/50 p-4 md:p-5 rounded-2xl border border-emerald-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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
                                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                                    />
                                    {showProductDropdown && productSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-40 max-h-80 overflow-auto">
                                            {filteredProducts.length > 0 ? (
                                                filteredProducts.map(product => (
                                                    <div key={product.id} className="border-b border-slate-100 last:border-0">
                                                        <button
                                                            onClick={() => {
                                                                if (product.variants.length > 1) {
                                                                    setExpandedProductId(expandedProductId === product.id ? null : product.id);
                                                                } else {
                                                                    addProductFromList(product);
                                                                }
                                                            }}
                                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3"
                                                        >
                                                            <img
                                                                src={product.image}
                                                                alt={product.name}
                                                                className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-slate-800 text-sm truncate">{product.name}</div>
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                                                    {product.variants.length} loại • từ {formatPrice(Math.min(...product.variants.map(v => v.price)))}
                                                                </div>
                                                            </div>
                                                            {product.variants.length > 1 && (
                                                                <ChevronDown
                                                                    size={16}
                                                                    className={`text-slate-400 transition-transform duration-300 ${expandedProductId === product.id ? 'rotate-180' : ''}`}
                                                                />
                                                            )}
                                                        </button>

                                                        {expandedProductId === product.id && product.variants.length > 1 && (
                                                            <div className="bg-slate-50 py-2 animate-in slide-in-from-top-2 duration-200">
                                                                {product.variants.map((variant, vIndex) => (
                                                                    <button
                                                                        key={vIndex}
                                                                        onClick={() => addVariantToOrder(product, variant)}
                                                                        className="w-full pl-16 pr-4 py-2.5 text-left hover:bg-white flex items-center justify-between group"
                                                                    >
                                                                        <div className="text-xs">
                                                                            <span className="font-black text-slate-700">{variant.size}</span>
                                                                            <span className="text-slate-300 mx-2">|</span>
                                                                            <span className="text-slate-500 font-medium">{variant.unit}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="font-black text-emerald-600 text-sm">{formatPrice(variant.price)}</span>
                                                                            <Plus size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-slate-500 text-sm">Không tìm thấy sản phẩm</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 bg-white px-4 py-2.5 border border-slate-200 rounded-xl w-full md:w-auto justify-center">
                                    <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">SL:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={addQuantity === 0 ? '' : addQuantity}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAddQuantity(val === '' ? 0 : parseInt(val) || 0);
                                        }}
                                        className="w-16 py-1 text-center font-black text-slate-800 focus:outline-none text-lg"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Manual Entry Options */}
                                <div className="flex flex-wrap items-center gap-4 p-3 bg-white rounded-xl border border-slate-200">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cấu trúc hàng nhập tay:</span>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newOrder.showSoCuon}
                                                onChange={(e) => setNewOrder({ ...newOrder, showSoCuon: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="text-slate-700 font-medium">Số cuộn</span>
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newOrder.showSoKi}
                                                onChange={(e) => setNewOrder({ ...newOrder, showSoKi: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="text-slate-700 font-medium">Số kí</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Manual Entry Input Row */}
                                <ManualEntryRow
                                    newOrder={newOrder}
                                    setNewOrder={setNewOrder}
                                />
                            </div>
                        )}
                    </div>

                    {/* Order Items List */}
                    {newOrder.items.length > 0 && (
                        <OrderItemsTable
                            items={newOrder.items}
                            updateItemField={updateItemField}
                            removeItem={removeItem}
                            hasSoCuon={hasSoCuonInTable}
                            hasSoKi={hasSoKiInTable}
                            formatPrice={formatPrice}
                        />
                    )}

                    {/* Order Summary & Actions */}
                    <OrderSummarySection
                        newOrder={newOrder}
                        setNewOrder={setNewOrder}
                        getSubtotal={getSubtotal}
                        getTotal={getTotal}
                        formatPrice={formatPrice}
                        handleCreateAndExportPDF={handleCreateAndExportPDF}
                        handleThermalPrint={handleThermalPrint}
                        handleSaveOrder={handleSaveOrder}
                    />
                </div>
            </section>
        </div>
    );
};
