import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { isAdminAuthenticated } from './LoginModal';
import { useAdminSettings } from '../hooks/useAdminSettings';
import { PhoneSettings } from './admin/PhoneSettings';
import { ShopInfoSettings } from './admin/ShopInfoSettings';
import { BankSettings } from './admin/BankSettings';
import { CloudSettings } from './admin/CloudSettings';
import { BackupSettings } from './admin/BackupSettings';
import { CategorySettings } from './admin/CategorySettings';
import { SecuritySettings } from './admin/SecuritySettings';

export const AdminSettings: React.FC = () => {
    if (!isAdminAuthenticated()) {
        window.location.hash = '#/';
        return null;
    }

    const {
        settings, setSettings,
        categories,
        newCategoryName, setNewCategoryName,
        editingCategory, setEditingCategory,
        editCategoryName, setEditCategoryName,
        showDeleteConfirm, setShowDeleteConfirm,
        saveSuccess,
        fileInputRef,
        bankInfo, setBankInfo,
        taxRate, setTaxRate,
        bankSaveSuccess,
        apiUrl, setApiUrl,
        adminSecret, setAdminSecret,
        connectionSaveSuccess,
        isSyncing, isPulling,
        handleSavePhone,
        handleSaveBankInfo,
        handleSaveConnection,
        handleAddCategory,
        handleUpdateCategory,
        handleDeleteCategory,
        startEditing,
        handleBackup,
        handleFileImport,
        handleSyncToCloud,
        handlePullFromCloud
    } = useAdminSettings();

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <a
                                href="#/admin"
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                <ArrowLeft size={20} />
                                <span className="hidden sm:inline font-medium">Quản lý SP</span>
                            </a>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <h1 className="text-xl font-bold text-slate-800">Cài đặt</h1>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <PhoneSettings
                    settings={settings}
                    setSettings={setSettings}
                    handleSavePhone={handleSavePhone}
                    saveSuccess={saveSuccess}
                />

                <ShopInfoSettings />

                <BankSettings
                    bankInfo={bankInfo}
                    setBankInfo={setBankInfo}
                    taxRate={taxRate}
                    setTaxRate={setTaxRate}
                    handleSaveBankInfo={handleSaveBankInfo}
                    bankSaveSuccess={bankSaveSuccess}
                />

                <CloudSettings
                    apiUrl={apiUrl}
                    setApiUrl={setApiUrl}
                    adminSecret={adminSecret}
                    setAdminSecret={setAdminSecret}
                    handleSaveConnection={handleSaveConnection}
                    connectionSaveSuccess={connectionSaveSuccess}
                />

                <BackupSettings
                    handleBackup={handleBackup}
                    handleFileImport={handleFileImport}
                    handleSyncToCloud={handleSyncToCloud}
                    handlePullFromCloud={handlePullFromCloud}
                    isSyncing={isSyncing}
                    isPulling={isPulling}
                    fileInputRef={fileInputRef}
                />

                <CategorySettings
                    categories={categories}
                    newCategoryName={newCategoryName}
                    setNewCategoryName={setNewCategoryName}
                    handleAddCategory={handleAddCategory}
                    editingCategory={editingCategory}
                    editCategoryName={editCategoryName}
                    setEditCategoryName={setEditCategoryName}
                    handleUpdateCategory={handleUpdateCategory}
                    setEditingCategory={setEditingCategory}
                    startEditing={startEditing}
                    setShowDeleteConfirm={setShowDeleteConfirm}
                />

                <SecuritySettings />
            </main>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
                        <p className="text-slate-600 mb-6">
                            Bạn có chắc chắn muốn xóa danh mục này? Các sản phẩm thuộc danh mục sẽ không bị xóa.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleDeleteCategory(showDeleteConfirm)}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                            >
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
