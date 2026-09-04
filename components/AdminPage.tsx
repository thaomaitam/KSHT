import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Package, Settings, BarChart3, Search } from 'lucide-react';
import { Product } from '../types';
import { storageService } from '../storageService';
import { settingsService, CategoryItem } from '../settingsService';
import { ProductForm } from './ProductForm';
import { isAdminAuthenticated } from './LoginModal';

export const AdminPage: React.FC = () => {
    if (!isAdminAuthenticated()) {
        window.location.hash = '#/';
        return null;
    }

    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');

    useEffect(() => {
        const loadData = async () => {
            const prods = await storageService.getAdminProducts();
            const cats = await settingsService.getCategories();
            setProducts(prods);
            setCategories(cats);
        };
        loadData();
    }, []);

    const handleSave = async (product: Product) => {
        try {
            if (editingProduct) {
                setProducts(await storageService.updateProduct(product));
            } else {
                setProducts(await storageService.addProduct(product));
            }
            setShowForm(false);
            setEditingProduct(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không lưu được sản phẩm.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            setProducts(await storageService.deleteProduct(id));
            setShowDeleteConfirm(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không xóa được sản phẩm.');
        }
    };

    const openAddForm = () => {
        setEditingProduct(null);
        setShowForm(true);
    };

    const openEditForm = (product: Product) => {
        setEditingProduct(product);
        setShowForm(true);
    };

    const getCategoryLabel = (value: string) => {
        return categories.find(c => c.value === value)?.label || value;
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    };

    const filteredProducts = products
        .filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'ALL' || product.category === selectedCategory;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => a.category.localeCompare(b.category));

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <a
                                href="#/"
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                <ArrowLeft size={20} />
                                <span className="hidden sm:inline font-medium">Về trang chính</span>
                            </a>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Package size={24} className="text-primary-600" />
                                Quản lý sản phẩm
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href="#/admin/settings"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Cài đặt"
                            >
                                <Settings size={16} />
                                <span className="hidden sm:inline">Cài đặt</span>
                            </a>
                            <a
                                href="#/admin/business"
                                className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors font-medium"
                                title="Kinh doanh"
                            >
                                <BarChart3 size={16} />
                                <span className="hidden sm:inline">Kinh doanh</span>
                            </a>
                            <button
                                onClick={openAddForm}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                            >
                                <Plus size={18} />
                                <span>Thêm mới</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Filters - Mobile Optimized */}
                    <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
                        {/* Search Row - Full Width on Mobile */}
                        <div className="relative w-full">
                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm sản phẩm..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                            />
                        </div>
                        {/* Category & Count Row */}
                        <div className="flex items-center justify-between gap-3">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="flex-1 max-w-[200px] px-4 py-3 text-base border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                            >
                                <option value="ALL">Tất cả nhóm</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                            <p className="text-sm text-slate-600 whitespace-nowrap">
                                <span className="font-semibold text-slate-900">{filteredProducts.length}</span> / {products.length} SP
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Sản phẩm
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                                        Danh mục
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                                        Giá từ
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                                        Variants
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Hành động
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                                                />
                                                <div>
                                                    <div className="font-medium text-slate-900 flex items-center gap-2">
                                                        {product.name}
                                                        {product.isHot && (
                                                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                                                                Hot
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-500 md:hidden">
                                                        {getCategoryLabel(product.category)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full">
                                                {getCategoryLabel(product.category)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 hidden sm:table-cell">
                                            <span className="font-medium text-primary-600">
                                                {formatPrice(Math.min(...product.variants.map(v => v.price)))}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 hidden lg:table-cell">
                                            <span className="text-sm text-slate-600">
                                                {product.variants.length} kích thước
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEditForm(product)}
                                                    className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(product.id)}
                                                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Xóa"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {products.length === 0 && (
                        <div className="py-16 text-center">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500">Chưa có sản phẩm nào</p>
                            <button
                                onClick={openAddForm}
                                className="mt-4 text-primary-600 font-medium hover:underline"
                            >
                                Thêm sản phẩm đầu tiên
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Product Form Modal */}
            {showForm && (
                <ProductForm
                    product={editingProduct}
                    onSave={handleSave}
                    onClose={() => {
                        setShowForm(false);
                        setEditingProduct(null);
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
                        <p className="text-slate-600 mb-6">
                            Bạn có chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteConfirm)}
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
