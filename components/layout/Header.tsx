import React from 'react';
import { ShoppingBag, Search, ShoppingCart, Package, BarChart3, Settings, RefreshCw, Lock, Tags, Sun, Moon } from 'lucide-react';
import { CategoryItem } from '../../settingsService';
import { isAdminAuthenticated, logoutAdmin } from '../LoginModal';
import { useCart } from '../../CartContext';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
    activeCategory: string;
    setActiveCategory: (cat: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    categories: CategoryItem[];
    setShowCart: (show: boolean) => void;
    setShowLoginModal: (show: boolean) => void;
    currentPage: string;
}

const CartBadge: React.FC = () => {
    const { getTotalItems } = useCart();
    const count = getTotalItems();
    if (count === 0) return null;
    return (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {count > 99 ? '99+' : count}
        </span>
    );
};

export const Header: React.FC<HeaderProps> = ({
    activeCategory,
    setActiveCategory,
    searchTerm,
    setSearchTerm,
    categories,
    setShowCart,
    setShowLoginModal,
    currentPage
}) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Top Row: Logo, Search, Actions */}
                <div className="flex items-center justify-between h-16 md:h-20 gap-4 md:gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => { setActiveCategory('ALL'); setSearchTerm(''); }}>
                        <div className="bg-primary-600 p-2 rounded-xl text-white shadow-lg shadow-primary-200 dark:shadow-primary-900">
                            <ShoppingBag size={24} />
                        </div>
                        <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 hidden sm:block">
                            Giaban
                        </span>
                    </div>

                    {/* Desktop Search Bar - Integrated */}
                    <div className="hidden md:flex flex-grow max-w-xl relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-2xl leading-5 bg-slate-50/50 dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                            placeholder="Tìm kiếm sản phẩm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                            title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
                        >
                            {isDark ? <Sun size={22} /> : <Moon size={22} />}
                        </button>

                        <button
                            onClick={() => setShowCart(true)}
                            className="relative p-2.5 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                            title="Giỏ hàng"
                        >
                            <ShoppingCart size={22} />
                            <CartBadge />
                        </button>

                        {/* Admin Actions */}
                        {isAdminAuthenticated() ? (
                            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-600">
                                <button
                                    onClick={() => window.location.hash = '#/admin'}
                                    className={`p-2 rounded-xl transition-colors ${currentPage === 'admin' ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    title="Quản lý sản phẩm"
                                >
                                    <Package size={20} />
                                </button>
                                <button
                                    onClick={() => window.location.hash = '#/admin/business'}
                                    className={`p-2 rounded-xl transition-colors ${currentPage === 'business' ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    title="Quản lý kinh doanh"
                                >
                                    <BarChart3 size={20} />
                                </button>
                                <button
                                    onClick={() => window.location.hash = '#/admin/settings'}
                                    className={`p-2 rounded-xl transition-colors ${currentPage === 'settings' ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    title="Cài đặt hệ thống"
                                >
                                    <Settings size={20} />
                                </button>
                                <button
                                    onClick={() => {
                                        logoutAdmin();
                                        window.location.hash = '#/';
                                        window.location.reload();
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                                    title="Đăng xuất"
                                >
                                    <RefreshCw size={20} className="rotate-180" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowLoginModal(true)}
                                className="p-2 text-slate-300 hover:text-slate-400 transition-colors ml-2"
                                title="Admin Login"
                            >
                                <Lock size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Navigation Bar - Desktop & Mobile */}
                <div className="border-t border-slate-100 dark:border-slate-700 py-3">
                    <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="flex-shrink-0 flex items-center gap-2 text-slate-400 dark:text-slate-500 pr-2 border-r border-slate-100 dark:border-slate-700 mr-1">
                            <Tags size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Danh mục</span>
                        </div>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.value)}
                                className={`flex-none px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 border ${activeCategory === cat.value
                                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-100 dark:shadow-primary-900 scale-105'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-primary-300 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile Search Bar - Visible only on mobile */}
                <div className="md:hidden py-3 border-t border-slate-50 dark:border-slate-700">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl leading-5 bg-slate-50/50 dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                            placeholder="Tìm sản phẩm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </header>
    );
};
