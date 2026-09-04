import React, { useState, useEffect, useRef } from 'react';
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

    const [bankInfo, setBankInfo] = useState<BankInfo>({
        bankName: '',
        accountNumber: '',
        accountName: ''
    });
    const [taxRate, setTaxRate] = useState<number>(0);
    const [bankSaveSuccess, setBankSaveSuccess] = useState(false);

    const [apiUrl, setApiUrl] = useState('');
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
    };

    const handleSavePhone = async () => {
        try {
            await settingsService.saveSettings(settings);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không lưu được số điện thoại.');
        }
    };

    const handleSaveBankInfo = async () => {
        try {
            await businessService.saveBankInfo(bankInfo);
            await businessService.saveTaxRate(taxRate);
            setBankSaveSuccess(true);
            setTimeout(() => setBankSaveSuccess(false), 2000);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không lưu được thông tin ngân hàng.');
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
        const data = {
            products: await storageService.getAdminProducts(),
            categories: await settingsService.getCategories(),
            settings: await settingsService.getSettings(),
            orders: await businessService.getOrders(),
            customers: await businessService.getCustomers(),
            costPrices: await businessService.getCostPrices(),
            transactions: await businessService.getTransactions(),
            bankInfo: await businessService.getBankInfo(),
            taxRate: await businessService.getTaxRate(),
            shopTemplates: await businessService.getShopTemplates(),
            backupDate: new Date().toISOString(),
            version: '1.2'
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
        alert('Khôi phục file JSON toàn bộ đã tắt. Dùng MCP backup/restore (preview rồi confirm).');
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
