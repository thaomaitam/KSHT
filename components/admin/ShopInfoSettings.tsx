import React, { useState, useEffect } from 'react';
import { Store, Save, Check, Plus, Trash2, Star } from 'lucide-react';
import { businessService, ShopTemplate } from '../../businessService';
import { NoticeBanner } from '../NoticeBanner';

export const ShopInfoSettings: React.FC = () => {
    const [templates, setTemplates] = useState<ShopTemplate[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        void loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoadError('');
        try {
            const data = await businessService.getShopTemplates();
            setTemplates(data.items);
            setTruncated(data.truncated);
            if (data.items.length > 0) {
                setEditingId((current) => current || data.items.find(t => t.isDefault)?.id || data.items[0].id);
            }
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Không tải được mẫu in.');
        }
    };

    const handleAddTemplate = () => {
        const newTemplate: ShopTemplate = {
            id: 'temp_' + Date.now(),
            name: 'Mẫu mới',
            address: '',
            phone: '',
            isDefault: templates.length === 0,
            revision: 1,
        };
        setTemplates([...templates, newTemplate]);
        setEditingId(newTemplate.id);
    };

    const handleDeleteTemplate = async (id: string) => {
        const current = templates.find(t => t.id === id);
        if (!current) return;
        if (id.startsWith('temp_')) {
            const next = templates.filter(t => t.id !== id);
            setTemplates(next);
            if (editingId === id) setEditingId(next[0]?.id || null);
            return;
        }
        try {
            const next = await businessService.archiveShopTemplate(id, current.revision);
            setTemplates(next.items);
            setTruncated(next.truncated);
            setEditingId(next.items[0]?.id || null);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không lưu trữ được mẫu.');
        }
    };

    const handleSetDefault = async (id: string) => {
        const current = templates.find(t => t.id === id);
        if (!current || current.id.startsWith('temp_')) {
            setTemplates(templates.map(t => ({ ...t, isDefault: t.id === id })));
            return;
        }
        try {
            const next = await businessService.setDefaultShopTemplate(id, current.revision || 1);
            setTemplates(next.items);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không đặt mặc định được.');
        }
    };

    const handleUpdateField = (id: string, field: keyof ShopTemplate, value: string) => {
        setTemplates(templates.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleSave = async () => {
        const current = templates.find(t => t.id === editingId);
        if (!current) return;
        setIsSaving(true);
        try {
            const saved = await businessService.saveShopTemplate(current);
            await loadTemplates();
            setEditingId(saved.id);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không lưu được mẫu in.');
        } finally {
            setIsSaving(false);
        }
    };

    const currentTemplate = templates.find(t => t.id === editingId);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-pink-50 to-rose-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                        <Store size={20} className="text-pink-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Mẫu in hóa đơn</h3>
                        <p className="text-sm text-slate-500">Lưu từng mẫu với revision; không ghi local-only.</p>
                    </div>
                </div>
                <button
                    onClick={handleAddTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-pink-200 text-pink-600 rounded-xl text-sm font-bold hover:bg-pink-50 transition-all shadow-sm"
                >
                    <Plus size={18} />
                    Thêm mẫu
                </button>
            </div>

            {loadError && <div className="px-6 pt-4"><NoticeBanner kind="error" message={loadError} onRetry={loadTemplates} /></div>}
            {truncated && <div className="px-6 pt-4"><NoticeBanner kind="warning" message="Danh sách mẫu in chưa tải đủ trang." /></div>}

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase px-2">Danh sách mẫu</p>
                    {templates.map(t => (
                        <div
                            key={t.id}
                            onClick={() => setEditingId(t.id)}
                            className={`group relative p-3 rounded-xl cursor-pointer transition-all border-2 ${editingId === t.id
                                ? 'border-pink-500 bg-pink-50'
                                : 'border-transparent bg-slate-50 hover:bg-slate-100'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className={`font-bold truncate ${editingId === t.id ? 'text-pink-700' : 'text-slate-700'}`}>
                                        {t.name}
                                    </span>
                                    {t.isDefault && <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void handleDeleteTemplate(t.id);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="md:col-span-2 space-y-6">
                    {currentTemplate ? (
                        <>
                            <div className="border-2 border-dashed border-pink-200 rounded-xl p-6 bg-pink-50/30">
                                <p className="text-xs text-pink-500 font-medium mb-4 text-center">XEM TRƯỚC HÓA ĐƠN</p>
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold text-pink-600 uppercase tracking-wide mb-2">
                                        {currentTemplate.name || 'Tên cửa hàng'}
                                    </h1>
                                    <div className="flex flex-col items-center gap-1 text-slate-600">
                                        <p className="flex items-center gap-2 text-sm">
                                            <span className="text-pink-500">📍</span>
                                            {currentTemplate.address || 'Địa chỉ cửa hàng'}
                                        </p>
                                        <p className="flex items-center gap-2 text-sm">
                                            <span className="text-pink-500">📞</span>
                                            {currentTemplate.phone || 'Số điện thoại'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Tên mẫu / Tên cửa hàng</label>
                                    <input
                                        type="text"
                                        value={currentTemplate.name}
                                        onChange={(e) => handleUpdateField(currentTemplate.id, 'name', e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Địa chỉ</label>
                                    <input
                                        type="text"
                                        value={currentTemplate.address}
                                        onChange={(e) => handleUpdateField(currentTemplate.id, 'address', e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>
                                    <input
                                        type="text"
                                        value={currentTemplate.phone}
                                        onChange={(e) => handleUpdateField(currentTemplate.id, 'phone', e.target.value)}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-4 pt-2">
                                    <button
                                        onClick={() => void handleSetDefault(currentTemplate.id)}
                                        disabled={currentTemplate.isDefault}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${currentTemplate.isDefault
                                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <Star size={18} className={currentTemplate.isDefault ? 'fill-amber-500' : ''} />
                                        {currentTemplate.isDefault ? 'Mẫu mặc định' : 'Đặt làm mặc định'}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-lg transition-all shadow-lg ${saveSuccess
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:scale-[1.02] active:scale-[0.98]'
                                    } disabled:opacity-50`}
                            >
                                {saveSuccess ? (
                                    <>
                                        <Check size={24} />
                                        ĐÃ LƯU MẪU NÀY
                                    </>
                                ) : (
                                    <>
                                        <Save size={24} />
                                        {isSaving ? 'ĐANG LƯU...' : 'LƯU MẪU ĐANG SỬA'}
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                            <Store size={48} className="mb-4 opacity-20" />
                            <p>Chọn một mẫu để chỉnh sửa hoặc thêm mẫu mới</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
