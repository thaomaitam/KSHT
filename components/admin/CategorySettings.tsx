import React from 'react';
import { Tags, Plus, Save, X, Edit2, Trash2 } from 'lucide-react';
import { CategoryItem } from '../../settingsService';

interface CategorySettingsProps {
    categories: CategoryItem[];
    newCategoryName: string;
    setNewCategoryName: (name: string) => void;
    handleAddCategory: () => Promise<void>;
    editingCategory: string | null;
    editCategoryName: string;
    setEditCategoryName: (name: string) => void;
    handleUpdateCategory: (id: string) => Promise<void>;
    setEditingCategory: (id: string | null) => void;
    startEditing: (category: CategoryItem) => void;
    setShowDeleteConfirm: (id: string | null) => void;
}

export const CategorySettings: React.FC<CategorySettingsProps> = ({
    categories, newCategoryName, setNewCategoryName, handleAddCategory,
    editingCategory, editCategoryName, setEditCategoryName, handleUpdateCategory,
    setEditingCategory, startEditing, setShowDeleteConfirm
}) => {
    return (
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
    );
};
