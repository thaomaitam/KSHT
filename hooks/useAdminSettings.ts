import React, { useState, useEffect, useRef } from 'react';
import { settingsService, CategoryItem, AppSettings } from '../settingsService';
import { storageService } from '../storageService';
import { businessService, BankInfo } from '../businessService';
import { apiService } from '../apiService';
import { createSubmitLock, isRetryableError, stepKey } from '../utils/operationState';

export const useAdminSettings = () => {
    const [settings, setSettings] = useState<AppSettings>({ phoneNumber: '' });
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [categoriesTruncated, setCategoriesTruncated] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const phoneLock = useRef(createSubmitLock());
    const bankLock = useRef(createSubmitLock());

    const [bankInfo, setBankInfo] = useState<BankInfo>({
        bankName: '',
        accountNumber: '',
        accountName: ''
    });
    const [taxRate, setTaxRate] = useState<number>(0);
    const [taxRevision, setTaxRevision] = useState<number>();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [bankSaveSuccess, setBankSaveSuccess] = useState(false);
    const [saving, setSaving] = useState(false);

    const [apiUrl, setApiUrl] = useState('');
    const [connectionSaveSuccess, setConnectionSaveSuccess] = useState(false);

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    useEffect(() => {
        void loadData().catch(() => {});
    }, []);

    const loadData = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [settingsData, categoriesData, bankInfoData, taxRateData] = await Promise.all([
                settingsService.getSettings(),
                settingsService.getCategoryLoad(),
                businessService.getBankInfo(),
                businessService.getTaxRate()
            ]);
            setSettings(settingsData);
            setCategories(categoriesData.categories);
            setCategoriesTruncated(categoriesData.truncated);
            setBankInfo(bankInfoData);
            setTaxRate(taxRateData.rate);
            setTaxRevision(taxRateData.revision);
            setApiUrl(apiService.getApiUrl());
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Không tải được cài đặt.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleSavePhone = async () => {
        const key = phoneLock.current.begin();
        if (key == null) return;
        setSaving(true);
        try {
            setSettings(await settingsService.saveSettings(settings, key));
            phoneLock.current.succeed();
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            if (isRetryableError(error)) phoneLock.current.failRetryable();
            else phoneLock.current.failTerminal();
            alert(error instanceof Error ? error.message : 'Không lưu được số điện thoại.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBankInfo = async () => {
        const key = bankLock.current.begin();
        if (key == null) return;
        setSaving(true);
        try {
            const savedBank = await businessService.saveBankInfo(bankInfo, stepKey(key, 'bank'));
            setBankInfo(savedBank);
            const savedTax = await businessService.saveTaxRate(taxRate, taxRevision, stepKey(key, 'tax'));
            setTaxRate(savedTax.rate);
            setTaxRevision(savedTax.revision);
            bankLock.current.succeed();
            setBankSaveSuccess(true);
            setTimeout(() => setBankSaveSuccess(false), 2000);
        } catch (error) {
            if (isRetryableError(error)) bankLock.current.failRetryable();
            else bankLock.current.failTerminal();
            alert(error instanceof Error ? error.message : 'Không lưu được thông tin ngân hàng.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConnection = () => {
        apiService.setApiUrl(apiUrl);
        setConnectionSaveSuccess(true);
        setTimeout(() => setConnectionSaveSuccess(false), 2000);
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            setCategories(await settingsService.addCategory(newCategoryName.trim()));
            setNewCategoryName('');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không thêm được danh mục.');
        }
    };

    const handleUpdateCategory = async (id: string) => {
        if (!editCategoryName.trim()) return;
        try {
            setCategories(await settingsService.updateCategory(id, editCategoryName.trim()));
            setEditingCategory(null);
            setEditCategoryName('');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không cập nhật được danh mục.');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        try {
            setCategories(await settingsService.deleteCategory(id));
            setShowDeleteConfirm(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không xóa được danh mục.');
        }
    };

    const startEditing = (category: CategoryItem) => {
        setEditingCategory(category.id);
        setEditCategoryName(category.label);
    };

    const handleBackup = async () => {
        const [products, categoriesData, settingsData, orders, customers, transactions, bank, tax, templates] = await Promise.all([
            storageService.getAdminProducts(),
            settingsService.getCategoryLoad(),
            settingsService.getSettings(),
            businessService.getOrders(),
            businessService.getCustomers(),
            businessService.getTransactions(),
            businessService.getBankInfo(),
            businessService.getTaxRate(),
            businessService.getShopTemplates(),
        ]);
        const data = {
            products: products.products,
            productsTruncated: products.truncated,
            categories: categoriesData.categories,
            settings: settingsData,
            orders: orders.items,
            ordersTruncated: orders.truncated,
            customers: customers.items,
            customersTruncated: customers.truncated,
            transactions: transactions.items,
            bankInfo: bank,
            taxRate: tax.rate,
            shopTemplates: templates.items,
            backupDate: new Date().toISOString(),
            version: '1.3',
            note: 'Sao lưu trình duyệt. Không phải restore máy chủ.',
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
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert('Khôi phục toàn bộ đã tắt. MCP cũng chưa hỗ trợ backup/restore an toàn; không nhập file này lên máy chủ.');
        void event;
    };

    const handleSyncToCloud = async () => {
        if (!apiService.getSessionToken()) {
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi đồng bộ.');
            return;
        }
        alert('Ghi admin đã đi qua /api/v1. Không còn đẩy whole-key /api/data.');
    };

    const handlePullFromCloud = async () => {
        if (!apiService.getSessionToken()) {
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            return;
        }
        setIsPulling(true);
        try {
            await loadData();
            alert('Đã tải lại dữ liệu từ /api/v1.');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không tải được dữ liệu từ máy chủ.');
        } finally {
            setIsPulling(false);
        }
    };

    return {
        settings, setSettings,
        categories, setCategories,
        categoriesTruncated,
        newCategoryName, setNewCategoryName,
        editingCategory, setEditingCategory,
        editCategoryName, setEditCategoryName,
        showDeleteConfirm, setShowDeleteConfirm,
        saveSuccess,
        fileInputRef,
        bankInfo, setBankInfo,
        taxRate, setTaxRate,
        bankSaveSuccess,
        saving, loading, loadError,
        apiUrl, setApiUrl,
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
