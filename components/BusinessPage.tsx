import React from 'react';
import { ArrowLeft, FileText, History, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { useBusinessData, TabType, OrderItem } from '../hooks/useBusinessData';
import { Order, businessService } from '../businessService';
import { OrderFormTab } from './business/OrderFormTab';
import { OrderHistoryTab } from './business/OrderHistoryTab';
import { CustomersTab } from './business/CustomersTab';
import { ProfitTab } from './business/ProfitTab';
import { ReportsTab } from './business/ReportsTab';
import { NoticeBanner } from './NoticeBanner';

export const BusinessPage: React.FC = () => {
    const data = useBusinessData();
    const {
        activeTab, setActiveTab,
        orders, setOrders,
        customers, setCustomers,
        bankInfo,
        shopTemplates,
        newOrder, setNewOrder,
        productSearch, setProductSearch,
        showProductDropdown, setShowProductDropdown,
        addQuantity, setAddQuantity,
        productDropdownRef,
        orderSearch, setOrderSearch,
        customerSearch, setCustomerSearch,
        filteredProducts,
        addProductFromList,
        addVariantToOrder,
        updateItemField,
        removeItem,
        getSubtotal,
        getTotal,
        handleSaveOrder,
        resetOrderForm,
        report,
        review,
        loading,
        loadError,
        saving,
        reload,
        ordersTruncated,
        customersTruncated,
        productsTruncated,
        customerMatches,
        searchExistingCustomers,
        selectCustomer,
    } = data;

    const tabs = [
        { id: 'orders', label: 'Tạo đơn', icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'history', label: 'Lịch sử', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'customers', label: 'Khách hàng', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        { id: 'profit', label: 'Lợi nhuận', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'reports', label: 'Báo cáo', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    const handleRecreateOrder = (order: Order) => {
        const items: OrderItem[] = order.items.map((item: any) => ({
            id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            productId: item.productId || null,
            name: item.name,
            unit: item.unit,
            quantity: item.quantity,
            soCuon: item.soCuon,
            soKi: item.soKi,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            total: item.total,
            isManual: item.isManual
        }));
        const hasSoCuon = items.some(item => item.soCuon !== undefined && item.soCuon > 0);
        const hasSoKi = items.some(item => item.soKi !== undefined && item.soKi > 0);
        const originalTemplate = shopTemplates.find(t => t.id === order.shopTemplateId);
        const defaultTemplate = shopTemplates.find(t => t.isDefault) || shopTemplates[0];
        const templateToUse = originalTemplate || defaultTemplate;

        setNewOrder({
            customerId: order.customerId || '',
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            items,
            shippingFee: order.shippingFee || 0,
            discount: order.discount || 0,
            collectAmount: 0,
            note: order.note || '',
            isManualEntry: true,
            showSoCuon: hasSoCuon,
            showSoKi: hasSoKi,
            selectedTemplateId: templateToUse?.id || 'default',
            totalAmountInWords: '',
            paymentMethod: order.paymentMethod,
            createNewCustomer: !order.customerId,
        });
        setActiveTab('orders');
    };

    const handleCreateOrderFromCustomer = async (customer: { id: string }) => {
        const detail = await businessService.loadCustomer(customer.id);
        setNewOrder({
            ...newOrder,
            customerId: detail.id,
            customerName: detail.name,
            phone: detail.phone,
            address: detail.address,
            items: [],
            shippingFee: 0,
            discount: 0,
            collectAmount: 0,
            note: '',
            isManualEntry: false,
            showSoCuon: false,
            showSoKi: false,
            createNewCustomer: false,
        });
        setActiveTab('orders');
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.location.hash = '#/'}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">Quản lý kinh doanh</h1>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar">
                    <div className="flex gap-2 py-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? `${tab.bg} ${tab.color} shadow-sm ring-1 ring-inset ring-slate-200`
                                    : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-4">
                {loading && <NoticeBanner kind="info" message="Đang tải dữ liệu kinh doanh từ /api/v1..." />}
                {loadError && <NoticeBanner kind="error" title="Không tải được" message={loadError} onRetry={reload} />}
                {review && !review.ready && (
                    <NoticeBanner kind="warning" title="Rà soát lịch sử" message={review.message} />
                )}
                {productsTruncated && activeTab === 'orders' && (
                    <NoticeBanner kind="warning" message="Catalog chọn hàng chưa tải đủ trang. Phần đang hiện có thể thiếu." />
                )}

                {activeTab === 'orders' && (
                    <OrderFormTab
                        newOrder={newOrder}
                        setNewOrder={setNewOrder}
                        productSearch={productSearch}
                        setProductSearch={setProductSearch}
                        showProductDropdown={showProductDropdown}
                        setShowProductDropdown={setShowProductDropdown}
                        filteredProducts={filteredProducts}
                        addProductFromList={addProductFromList}
                        addVariantToOrder={addVariantToOrder}
                        addQuantity={typeof addQuantity === 'number' ? addQuantity : 1}
                        setAddQuantity={setAddQuantity}
                        updateItemField={updateItemField}
                        removeItem={removeItem}
                        getSubtotal={getSubtotal}
                        getTotal={getTotal}
                        handleSaveOrder={handleSaveOrder}
                        bankInfo={bankInfo}
                        shopTemplates={shopTemplates}
                        orderCount={orders.length}
                        resetOrderForm={resetOrderForm}
                        productDropdownRef={productDropdownRef}
                        customerMatches={customerMatches}
                        searchExistingCustomers={searchExistingCustomers}
                        selectCustomer={selectCustomer}
                        saving={saving}
                    />
                )}

                {activeTab === 'history' && (
                    <OrderHistoryTab
                        orders={orders}
                        setOrders={setOrders}
                        orderSearch={orderSearch}
                        setOrderSearch={setOrderSearch}
                        onRecreateOrder={handleRecreateOrder}
                        bankInfo={bankInfo}
                        shopTemplates={shopTemplates}
                        customers={customers}
                        setCustomers={setCustomers}
                        truncated={ordersTruncated}
                        onReload={reload}
                    />
                )}

                {activeTab === 'customers' && (
                    <CustomersTab
                        customers={customers}
                        setCustomers={setCustomers}
                        customerSearch={customerSearch}
                        setCustomerSearch={setCustomerSearch}
                        onCreateOrder={handleCreateOrderFromCustomer}
                        truncated={customersTruncated}
                    />
                )}

                {activeTab === 'profit' && (
                    <ProfitTab report={report} />
                )}

                {activeTab === 'reports' && (
                    <ReportsTab report={report} truncated={ordersTruncated || customersTruncated} />
                )}
            </main>
        </div>
    );
};
