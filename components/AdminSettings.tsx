import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Save, Phone, Tags, X, Download, Upload, CreditCard, Cloud, RefreshCw, Lock } from 'lucide-react';
import { settingsService, CategoryItem, AppSettings } from '../settingsService';
import { storageService } from '../storageService';
import { businessService, BankInfo } from '../businessService';
import { apiService } from '../apiService';
import { isAdminAuthenticated } from './LoginModal';

export const AdminSettings: React.FC = () => {
    if (!isAdminAuthenticated()) {
        window.location.hash = '#/';
        return null;
    }

    const [settings, setSettings] = useState<AppSettings>({ phoneNumber: '' });
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Bank Info states
    const [bankInfo, setBankInfo] = useState<BankInfo>({
        bankName: '',
        accountNumber: '',
        accountName: ''
    });
    const [taxRate, setTaxRate] = useState<number>(0);
    const [bankSaveSuccess, setBankSaveSuccess] = useState(false);

    // Cloudflare connection states
    const [apiUrl, setApiUrl] = useState('');
    const [adminSecret, setAdminSecret] = useState('');
    const [connectionSaveSuccess, setConnectionSaveSuccess] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setSettings(await settingsService.getSettings());
            setCategories(await settingsService.getCategories());

            // Load bank info and tax rate
            const savedBankInfo = await businessService.getBankInfo();
            if (savedBankInfo) {
                setBankInfo(savedBankInfo);
            }
            setTaxRate(await businessService.getTaxRate());

            // Load API credentials
            setApiUrl(apiService.getApiUrl());
            setAdminSecret(apiService.getAdminSecret());
        };
        loadData();
    }, []);

    const handleSavePhone = async () => {
        await settingsService.saveSettings(settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const handleSaveBankInfo = async () => {
        await businessService.saveBankInfo(bankInfo);
        await businessService.saveTaxRate(taxRate);
        setBankSaveSuccess(true);
        setTimeout(() => setBankSaveSuccess(false), 2000);
    };

    const handleSaveConnection = () => {
        apiService.setApiCredentials(apiUrl, adminSecret);
        setConnectionSaveSuccess(true);
        setTimeout(() => setConnectionSaveSuccess(false), 2000);
    };

    const handleAddCategory = async () => {
        if (newCategoryName.trim()) {
            setCategories(await settingsService.addCategory(newCategoryName.trim()));
            setNewCategoryName('');
        }
    };

    const handleUpdateCategory = async (id: string) => {
        if (editCategoryName.trim()) {
            setCategories(await settingsService.updateCategory(id, editCategoryName.trim()));
            setEditingCategory(null);
            setEditCategoryName('');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        setCategories(await settingsService.deleteCategory(id));
        setShowDeleteConfirm(null);
    };

    const startEditing = (category: CategoryItem) => {
        setEditingCategory(category.id);
        setEditCategoryName(category.label);
    };

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const handleBackup = async () => {
        const data = {
            products: await storageService.getProducts(),
            categories: await settingsService.getCategories(),
            settings: await settingsService.getSettings(),
            orders: await businessService.getOrders(),
            customers: await businessService.getCustomers(),
            costPrices: await businessService.getCostPrices(),
            transactions: await businessService.getTransactions(),
            bankInfo: await businessService.getBankInfo(),
            taxRate: await businessService.getTaxRate(),
            backupDate: new Date().toISOString(),
            version: '1.1'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `giaban_full_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);

                if (confirm('Bạn có chắc chắn muốn khôi phục dữ liệu từ file này? Dữ liệu hiện tại (bao gồm cả trên Cloud nếu đang kết nối) sẽ bị thay thế.')) {
                    setIsSyncing(true);
                    // Restore data
                    if (data.products) await storageService.saveProducts(data.products);
                    if (data.categories) await settingsService.saveCategories(data.categories);
                    if (data.settings) await settingsService.saveSettings(data.settings);

                    // Restore business data
                    if (data.orders) await businessService.saveOrders(data.orders);
                    if (data.customers) await businessService.saveCustomers(data.customers);
                    if (data.costPrices) await businessService.saveCostPrices(data.costPrices);
                    if (data.transactions) await businessService.saveTransactions(data.transactions);
                    if (data.bankInfo) await businessService.saveBankInfo(data.bankInfo);
                    if (data.taxRate !== undefined) await businessService.saveTaxRate(data.taxRate);

                    alert('Khôi phục dữ liệu thành công! Trang sẽ được tải lại để áp dụng thay đổi.');
                    window.location.reload();
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Lỗi khi đọc file backup. Vui lòng kiểm tra lại định dạng file.');
            } finally {
                setIsSyncing(false);
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSyncToCloud = async () => {
        if (!apiService.getAdminSecret()) {
            alert('Vui lòng cấu hình kết nối Cloudflare trước khi đồng bộ.');
            return;
        }
        if (!confirm('Bạn có muốn đẩy toàn bộ dữ liệu máy này lên Cloud? Dữ liệu cũ trên Cloud sẽ bị ghi đè hoàn toàn.')) return;

        setIsSyncing(true);
        try {
            const [products, categories, settings, orders, customers, costPrices, transactions, bankInfo, taxRate] = await Promise.all([
                storageService.getProducts(),
                settingsService.getCategories(),
                settingsService.getSettings(),
                businessService.getOrders(),
                businessService.getCustomers(),
                businessService.getCostPrices(),
                businessService.getTransactions(),
                businessService.getBankInfo(),
                businessService.getTaxRate()
            ]);

            await Promise.all([
                storageService.saveProducts(products),
                settingsService.saveCategories(categories),
                settingsService.saveSettings(settings),
                businessService.saveOrders(orders),
                businessService.saveCustomers(customers),
                businessService.saveCostPrices(costPrices),
                businessService.saveTransactions(transactions),
                bankInfo ? businessService.saveBankInfo(bankInfo) : Promise.resolve(),
                businessService.saveTaxRate(taxRate)
            ]);

            alert('Đồng bộ dữ liệu lên Cloud thành công!');
        } catch (error) {
            console.error('Sync error:', error);
            alert('Lỗi khi đồng bộ dữ liệu. Vui lòng kiểm tra lại API URL và Admin Secret.');
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePullFromCloud = async () => {
        if (!apiService.getAdminSecret()) {
            alert('Vui lòng cấu hình kết nối Cloudflare trước.');
            return;
        }
        if (!confirm('Bạn có muốn tải toàn bộ dữ liệu từ Cloud về máy này? Dữ liệu hiện tại trên máy sẽ bị ghi đè.')) return;

        setIsPulling(true);
        try {
            // The services' get methods already pull from API if secret is present
            // We just need to trigger them and they will update localStorage
            await Promise.all([
                storageService.getProducts(),
                settingsService.getCategories(),
                settingsService.getSettings(),
                businessService.getOrders(),
                businessService.getCustomers(),
                businessService.getCostPrices(),
                businessService.getTransactions(),
                businessService.getBankInfo(),
                businessService.getTaxRate()
            ]);

            alert('Đã tải dữ liệu từ Cloud về máy thành công! Trang sẽ tải lại.');
            window.location.reload();
        } catch (error) {
            console.error('Pull error:', error);
            alert('Lỗi khi tải dữ liệu từ Cloud.');
        } finally {
            setIsPulling(false);
        }
    };

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
                {/* Phone Number Settings */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                        <Phone size={20} className="text-primary-600" />
                        <h2 className="font-semibold text-slate-800">Số điện thoại liên hệ</h2>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-slate-500 mb-4">
                            Số điện thoại này sẽ hiển thị trong nút liên hệ và đơn hàng
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="tel"
                                value={settings.phoneNumber}
                                onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Nhập số điện thoại (vd: 0901234567)"
                            />
                            <button
                                onClick={handleSavePhone}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${saveSuccess
                                    ? 'bg-green-500 text-white'
                                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                                    }`}
                            >
                                <Save size={18} />
                                <span>{saveSuccess ? 'Đã lưu!' : 'Lưu'}</span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Bank Info Settings */}
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

                {/* Cloudflare Backend Connection */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                        <Cloud size={20} className="text-primary-600" />
                        <h2 className="font-semibold text-slate-800">Kết nối Cloudflare Backend</h2>
                    </div>
                    <div className="p-6">
                        <p className="text-sm text-slate-500 mb-4">
                            Cấu hình kết nối đến Cloudflare Worker để đồng bộ dữ liệu
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">API URL (Worker URL)</label>
                                <input
                                    type="url"
                                    value={apiUrl}
                                    onChange={(e) => setApiUrl(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="https://ksht-api.ngthanhhuy951.workers.dev"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Admin Secret</label>
                                <input
                                    type="password"
                                    value={adminSecret}
                                    onChange={(e) => setAdminSecret(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    placeholder="••••••••••••"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveConnection}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${connectionSaveSuccess
                                        ? 'bg-green-500 text-white'
                                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                                        }`}
                                >
                                    <RefreshCw size={18} />
                                    <span>{connectionSaveSuccess ? 'Đã lưu!' : 'Lưu kết nối'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Backup and Restore */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                        <Save size={20} className="text-primary-600" />
                        <h2 className="font-semibold text-slate-800">Sao Lưu Và Khôi Phục</h2>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Local Backup */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Dữ liệu Offline (File)</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Sao lưu toàn bộ dữ liệu ra file JSON để lưu trữ an toàn trên máy tính.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleBackup}
                                        className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
                                    >
                                        <Download size={18} />
                                        <span>Tải file sao lưu (.json)</span>
                                    </button>

                                    <div className="relative">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".json"
                                            onChange={handleFileImport}
                                            className="hidden"
                                            id="restore-file"
                                        />
                                        <label
                                            htmlFor="restore-file"
                                            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
                                        >
                                            <Upload size={18} />
                                            <span>Khôi phục từ file...</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Cloud Sync */}
                            <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-8 md:pt-0 md:pl-8">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Đồng bộ Cloud (Online)</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Đồng bộ dữ liệu giữa các thiết bị thông qua Cloudflare Backend.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleSyncToCloud}
                                        disabled={isSyncing}
                                        className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                                    >
                                        <Cloud size={18} className={isSyncing ? 'animate-bounce' : ''} />
                                        <span>{isSyncing ? 'Đang đồng bộ...' : 'Đẩy dữ liệu lên Cloud'}</span>
                                    </button>

                                    <button
                                        onClick={handlePullFromCloud}
                                        disabled={isPulling}
                                        className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={18} className={isPulling ? 'animate-spin' : ''} />
                                        <span>{isPulling ? 'Đang tải...' : 'Tải dữ liệu từ Cloud về'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Categories Settings */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                        <Tags size={20} className="text-primary-600" />
                        <h2 className="font-semibold text-slate-800">Quản lý danh mục</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Add new category */}
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Nhập tên danh mục mới..."
                            />
                            <button
                                onClick={handleAddCategory}
                                disabled={!newCategoryName.trim()}
                                className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={18} />
                                <span>Thêm</span>
                            </button>
                        </div>

                        {/* Categories list */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            {categories.map((category) => (
                                <div
                                    key={category.id}
                                    className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50"
                                >
                                    {editingCategory === category.id ? (
                                        <div className="flex-1 flex gap-2">
                                            <input
                                                type="text"
                                                value={editCategoryName}
                                                onChange={(e) => setEditCategoryName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(category.id)}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleUpdateCategory(category.id)}
                                                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                            >
                                                <Save size={16} />
                                            </button>
                                            <button
                                                onClick={() => setEditingCategory(null)}
                                                className="px-3 py-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <span className="font-medium text-slate-800">{category.label}</span>
                                                {category.value === 'ALL' && (
                                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Mặc định</span>
                                                )}
                                            </div>
                                            {category.value !== 'ALL' && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => startEditing(category)}
                                                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(category.id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                {/* Security & Ownership */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                        <Lock size={20} className="text-primary-600" />
                        <h2 className="font-semibold text-slate-800">Bảo mật & Quyền sở hữu</h2>
                    </div>
                    <div className="p-6">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                            <h3 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
                                <Lock size={18} />
                                Lưu ý về mật khẩu Admin
                            </h3>
                            <p className="text-amber-700 text-sm leading-relaxed">
                                Mật khẩu Admin được thiết lập trực tiếp trên <strong>Cloudflare Worker</strong> (biến môi trường <code>TK_ADMIN</code> và <code>MK_ADMIN</code>).
                                Để thay đổi mật khẩu hoặc quyền sở hữu, bạn cần truy cập vào trang quản trị Cloudflare của mình.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50">
                                <div>
                                    <h4 className="font-medium text-slate-800">Đăng xuất khỏi thiết bị này</h4>
                                    <p className="text-xs text-slate-500">Xóa phiên làm việc hiện tại trên trình duyệt này.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        sessionStorage.removeItem('giaban_admin_auth');
                                        window.location.hash = '#/';
                                        window.location.reload();
                                    }}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                                >
                                    Đăng xuất
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 border border-red-100 rounded-xl bg-red-50/30">
                                <div>
                                    <h4 className="font-medium text-red-800">Xóa toàn bộ dữ liệu máy này</h4>
                                    <p className="text-xs text-red-500">Xóa sạch localStorage (Sản phẩm, Cài đặt, Token). Không ảnh hưởng đến Cloud.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm('BẠN CÓ CHẮC CHẮN? Hành động này sẽ xóa sạch dữ liệu lưu trên trình duyệt này và đăng xuất.')) {
                                            localStorage.clear();
                                            sessionStorage.clear();
                                            window.location.hash = '#/';
                                            window.location.reload();
                                        }
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                                >
                                    Reset App
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
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
