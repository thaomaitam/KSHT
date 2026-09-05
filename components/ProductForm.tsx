import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { settingsService, CategoryItem } from '../settingsService';

interface ProductFormProps {
    product: Product | null;
    onSave: (product: Product) => Promise<void> | void;
    onClose: () => void;
}

const emptyVariant: ProductVariant = { size: '', unit: 'Cây', price: 0, costPrice: 0 };

export const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onClose }) => {
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState<Omit<Product, 'id'> & { id?: string }>({
        name: '',
        category: '',
        description: '',
        image: '',
        variants: [{ ...emptyVariant }],
        isHot: false,
    });

    useEffect(() => {
        const loadCategories = async () => {
            const allCats = await settingsService.getCategories();
            const cats = allCats.filter(c => c.value !== 'ALL');
            setCategories(cats);
            if (!product && cats.length > 0) {
                setFormData(prev => ({ ...prev, category: cats[0].value }));
            }
        };
        void loadCategories();
    }, [product]);

    useEffect(() => {
        if (product) {
            setFormData({
                ...product,
                variants: (product.variants || []).map((variant) => ({
                    ...variant,
                    costPrice: variant.costPrice ?? 0,
                })),
            });
        }
    }, [product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        const variants = formData.variants.filter(v => v.size && Number.isSafeInteger(v.price) && v.price >= 0);
        if (variants.length < 1) {
            setFormError('Cần ít nhất một dòng kích thước với giá nguyên.');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            await onSave({
                id: product?.id || '',
                name: formData.name,
                category: formData.category,
                description: formData.description,
                image: formData.image || '',
                variants,
                isHot: formData.isHot,
                revision: product?.revision,
            });
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Không lưu được sản phẩm.');
        } finally {
            setSaving(false);
        }
    };

    const updateVariant = (index: number, field: keyof ProductVariant, value: string | number) => {
        const updated = [...formData.variants];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, variants: updated });
    };

    const addVariant = () => {
        setFormData({ ...formData, variants: [...formData.variants, { ...emptyVariant }] });
    };

    const removeVariant = (index: number) => {
        if (formData.variants.length > 1) {
            setFormData({ ...formData, variants: formData.variants.filter((_, i) => i !== index) });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">
                        {product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {formError && <p className="text-sm text-red-600">{formError}</p>}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tên sản phẩm *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Ví dụ: Cọ Sơn Cán Gỗ Cao Cấp"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Danh mục *</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                        >
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Mô tả</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                            placeholder="Mô tả chi tiết về sản phẩm..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Link hình ảnh</label>
                        <input
                            type="url"
                            value={formData.image}
                            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="isHot"
                            checked={formData.isHot || false}
                            onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                            className="w-5 h-5 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="isHot" className="text-sm font-medium text-slate-700">
                            Sản phẩm nổi bật (hiển thị badge "Hot")
                        </label>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-slate-700">Kích thước, giá bán và giá gốc *</label>
                            <button
                                type="button"
                                onClick={addVariant}
                                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                                <Plus size={16} /> Thêm dòng
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.variants.map((variant, index) => (
                                <div key={index} className="flex gap-3 items-center">
                                    <input
                                        type="text"
                                        value={variant.size}
                                        onChange={(e) => updateVariant(index, 'size', e.target.value)}
                                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Kích thước (vd: 1 inch)"
                                    />
                                    <input
                                        type="text"
                                        value={variant.unit}
                                        onChange={(e) => updateVariant(index, 'unit', e.target.value)}
                                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Cây"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={variant.price || ''}
                                        onChange={(e) => updateVariant(index, 'price', parseInt(e.target.value, 10) || 0)}
                                        className="w-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Giá bán"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={variant.costPrice || ''}
                                        onChange={(e) => updateVariant(index, 'costPrice', parseInt(e.target.value, 10) || 0)}
                                        className="w-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Giá gốc"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeVariant(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        disabled={formData.variants.length === 1}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                            disabled={saving}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
                        >
                            {saving ? 'Đang lưu...' : product ? 'Cập nhật' : 'Thêm sản phẩm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
