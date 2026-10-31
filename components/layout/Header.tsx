import React from 'react';
import { ShoppingBag, Search, ShoppingCart, Package, BarChart3, Settings, RefreshCw, Lock, Sun, Moon } from 'lucide-react';
import { CategoryItem } from '../../settingsService';
import { Product } from '../../types';
import { CategorySheetButton } from '../CategoryNav';
import { groupCategories, displayCategoryLabel } from '../../utils/categoryGroups';
import { isAdminAuthenticated, logoutAdmin } from '../LoginModal';
import { useCart } from '../../CartContext';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
    activeCategory: string;
    setActiveCategory: (cat: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    /** True while a keyword query is active (results span all categories). */
    searching?: boolean;
    categories: CategoryItem[];
    setShowCart: (show: boolean) => void;
    setShowLoginModal: (show: boolean) => void;
    currentPage: string;
    products: Product[];
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
    searching = false,
    categories,
    setShowCart,
    setShowLoginModal,
    currentPage,
    products
}) => {
    const { isDark, toggleTheme } = useTheme();
    const groups = React.useMemo(() => groupCategories(categories, products), [categories, products]);
    const activeLabel = searching
        ? 'Tất cả (đang tìm)'
        : activeCategory === 'ALL'
        ? 'Tất cả sản phẩm'
        : displayCategoryLabel(categories.find(c => c.value === activeCategory)?.label ?? activeCategory);
    const selectCategory = (value: string) => {
        setActiveCategory(value);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Top Row: Logo, Search, Actions */}
                <div className="flex items-center justify-between h-16 md:h-20 gap-2 sm:gap-4 md:gap-8">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => { setActiveCategory('ALL'); setSearchTerm(''); }}>
                        <div className="bg-primary-600 p-2 rounded-xl text-white shadow-lg shadow-primary-200 dark:shadow-primary-900">
                            <ShoppingBag size={24} />
                        </div>
                        <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-primary-400 hidden sm:block">
                            Giaban
                        </span>
                    </div>

                    {/* Mobile category switcher: stays visible because the header is sticky */}
                    {groups.length > 0 && (
                        <CategorySheetButton
                            className="md:hidden flex-1 min-w-0"
                            groups={groups}
                            activeCategory={activeCategory}
                            onSelect={selectCategory}
                            totalCount={products.length}
                            activeLabel={activeLabel}
                        />
                    )}

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
                            aria-label="Tìm kiếm sản phẩm"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                            aria-label="Tìm kiếm sản phẩm"
                        />
                    </div>
                </div>
            </div>
        </header>
    );
};
