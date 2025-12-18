import React from 'react';
import { ArrowLeft, FileText, History, Users, CreditCard, BarChart3, Tag } from 'lucide-react';
import { useBusinessData, TabType } from '../hooks/useBusinessData';
import { OrderFormTab } from './business/OrderFormTab';
import { OrderHistoryTab } from './business/OrderHistoryTab';
import { CustomersTab } from './business/CustomersTab';
import { TransactionsTab } from './business/TransactionsTab';
import { ReportsTab } from './business/ReportsTab';
import { CostPricesTab } from './business/CostPricesTab';

export const BusinessPage: React.FC = () => {
    const {
        activeTab, setActiveTab,
        orders, setOrders,
        customers, setCustomers,
        transactions, setTransactions,
        products,
        bankInfo,
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
        costPrices, setCostPrices,
        filteredProducts,
        addProductFromList,
        updateItemField,
        removeItem,
        getSubtotal,
        getTotal,
        handleSaveOrder,
        resetOrderForm,
        updateCustomer,
        handleAddTransaction,
        handleSaveCostPrices
    } = useBusinessData();

    const tabs = [
        { id: 'orders', label: 'Tạo đơn', icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'history', label: 'Lịch sử', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'customers', label: 'Khách hàng', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        { id: 'transactions', label: 'Sổ thu chi', icon: CreditCard, color: 'text-orange-600', bg: 'bg-orange-50' },
        { id: 'reports', label: 'Báo cáo', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 'costPrices', label: 'Giá vốn', icon: Tag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

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
                        bankInfo={bankInfo}
                        updateCustomer={updateCustomer}
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

                {activeTab === 'transactions' && (
                    <TransactionsTab
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

                {activeTab === 'costPrices' && (
                    <CostPricesTab
                        products={products}
                        costPrices={costPrices}
                        setCostPrices={setCostPrices}
                        handleSaveCostPrices={handleSaveCostPrices}
                    />
                )}
            </main>
        </div>
    );
};
