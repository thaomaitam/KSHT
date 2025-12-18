import { useState, useEffect, useRef } from 'react';
import { settingsService, CategoryItem, AppSettings } from '../settingsService';
import { storageService } from '../storageService';
import { businessService, BankInfo } from '../businessService';
import { apiService } from '../apiService';

export const useAdminSettings = () => {
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

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [settingsData, categoriesData, bankInfoData, taxRateData] = await Promise.all([
            settingsService.getSettings(),
            settingsService.getCategories(),
            businessService.getBankInfo(),
            businessService.getTaxRate()
        ]);

        setSettings(settingsData);
        setCategories(categoriesData);
        if (bankInfoData) setBankInfo(bankInfoData);
        setTaxRate(taxRateData);

        setApiUrl(apiService.getApiUrl());
        setAdminSecret(apiService.getAdminSecret());
    };

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
            const updated = await settingsService.addCategory(newCategoryName.trim());
            setCategories(updated);
            setNewCategoryName('');
        }
    };

    const handleUpdateCategory = async (id: string) => {
        if (editCategoryName.trim()) {
            const updated = await settingsService.updateCategory(id, editCategoryName.trim());
            setCategories(updated);
            setEditingCategory(null);
            setEditCategoryName('');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        const updated = await settingsService.deleteCategory(id);
        setCategories(updated);
        setShowDeleteConfirm(null);
    };

    const startEditing = (category: CategoryItem) => {
        setEditingCategory(category.id);
        setEditCategoryName(category.label);
    };

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
                    if (data.products) await storageService.saveProducts(data.products);
                    if (data.categories) await settingsService.saveCategories(data.categories);
                    if (data.settings) await settingsService.saveSettings(data.settings);
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

    return {
        settings, setSettings,
        categories, setCategories,
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
    };
};
