import React from 'react';
import { ArrowLeft, FileText, History, Users, TrendingUp, BarChart3 } from 'lucide-react';
import { useBusinessData, TabType, OrderItem } from '../hooks/useBusinessData';
import { Order } from '../businessService';
import { OrderFormTab } from './business/OrderFormTab';
import { OrderHistoryTab } from './business/OrderHistoryTab';
import { CustomersTab } from './business/CustomersTab';
import { ProfitTab } from './business/ProfitTab';
import { ReportsTab } from './business/ReportsTab';


export const BusinessPage: React.FC = () => {
    const {
        activeTab, setActiveTab,
        orders, setOrders,
        customers, setCustomers,
        transactions, setTransactions,
        products,
        bankInfo,
        shopTemplates,
        newOrder, setNewOrder,
        productSearch, setProductSearch,
        showProductDropdown, setShowProductDropdown,
        addQuantity, setAddQuantity,
        productDropdownRef,
        orderSearch, setOrderSearch,
        customerSearch, setCustomerSearch,
        transactionSearch, setTransactionSearch,
        showTransactionModal, setShowTransactionModal,
        newTransaction, setNewTransaction,
        filteredProducts,
        addProductFromList,
        updateItemField,
        removeItem,
        getSubtotal,
        getTotal,
        handleSaveOrder,
        resetOrderForm,
        updateCustomer,
        handleAddTransaction
    } = useBusinessData();

    const tabs = [
        { id: 'orders', label: 'Tạo đơn', icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'history', label: 'Lịch sử', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'customers', label: 'Khách hàng', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        { id: 'profit', label: 'Lợi nhuận', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'reports', label: 'Báo cáo', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    // Handle recreate order - copy order data to form and switch to orders tab
    const handleRecreateOrder = (order: Order) => {
        const items: OrderItem[] = order.items.map((item: any) => ({
            id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
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

        // Check if any item has soCuon or soKi values
        const hasSoCuon = items.some(item => item.soCuon !== undefined && item.soCuon > 0);
        const hasSoKi = items.some(item => item.soKi !== undefined && item.soKi > 0);

        setNewOrder({
            customerName: order.customerName,
            phone: order.phone,
            address: order.address,
            items: items,
            shippingFee: order.shippingFee || 0,
            discount: order.discount || 0,
            debt: order.debt || 0,
            note: order.note || '',
            isManualEntry: true,
            showSoCuon: hasSoCuon,
            showSoKi: hasSoKi,
            selectedTemplateId: newOrder.selectedTemplateId
        });

        setActiveTab('orders');
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
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

                {/* Tab Navigation */}
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

            <main className="max-w-7xl mx-auto px-4 py-8">
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
                        addQuantity={addQuantity}
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
                        updateCustomer={updateCustomer}
                        setOrders={setOrders}
                        productDropdownRef={productDropdownRef}
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
                    />
                )}

                {activeTab === 'customers' && (
                    <CustomersTab
                        customers={customers}
                        setCustomers={setCustomers}
                        customerSearch={customerSearch}
                        setCustomerSearch={setCustomerSearch}
                    />
                )}

                {activeTab === 'profit' && (
                    <ProfitTab
                        orders={orders}
                        transactions={transactions}
                        setTransactions={setTransactions}
                        transactionSearch={transactionSearch}
                        setTransactionSearch={setTransactionSearch}
                        showTransactionModal={showTransactionModal}
                        setShowTransactionModal={setShowTransactionModal}
                        newTransaction={newTransaction}
                        setNewTransaction={setNewTransaction}
                        handleAddTransaction={handleAddTransaction}
                    />
                )}

                {activeTab === 'reports' && (
                    <ReportsTab
                        orders={orders}
                        transactions={transactions}
                        customers={customers}
                    />
                )}
            </main>
        </div>
    );
};
