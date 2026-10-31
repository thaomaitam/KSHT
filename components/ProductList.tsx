import React from 'react';
import { Search } from 'lucide-react';
import { CatalogLoad, Product } from '../types';
import { ProductCard } from './ProductCard';
import { CategoryItem } from '../settingsService';
import { NoticeBanner } from './NoticeBanner';
import { CategorySidebar, Breadcrumb } from './CategoryNav';
import { groupCategories, displayCategoryLabel } from '../utils/categoryGroups';

interface ProductListProps {
    filteredProducts: Product[];
    activeCategory: string;
    categories: CategoryItem[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    setActiveCategory: (cat: string) => void;
    setSelectedProduct: (product: Product) => void;
    catalog?: CatalogLoad;
    loading?: boolean;
    onRetry?: () => void;
}

export const ProductList: React.FC<ProductListProps> = ({
    filteredProducts,
    activeCategory,
    categories,
    searchTerm,
    setSearchTerm,
    setActiveCategory,
    setSelectedProduct, catalog, loading, onRetry
}) => {
    const allProducts = catalog?.products ?? [];
    const groups = React.useMemo(() => groupCategories(categories, allProducts), [categories, allProducts]);
    const isHome = activeCategory === 'ALL';
    const activeLabel = isHome
        ? 'Tất cả sản phẩm'
        : displayCategoryLabel(categories.find(c => c.value === activeCategory)?.label ?? activeCategory);
    const select = (value: string) => {
        setActiveCategory(value);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const categoryLabels = React.useMemo(
        () => new Map(categories.map(c => [c.value, displayCategoryLabel(c.label)])),
        [categories],
    );
    const navProps = { groups, activeCategory, onSelect: select, totalCount: allProducts.length };
    const productsTitle = isHome ? 'Tất cả sản phẩm' : activeLabel;

    return (
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-4">
            {loading && <NoticeBanner kind="info" message="Đang tải catalog cửa hàng..." />}
            {catalog?.error && (
                <NoticeBanner
                    kind={catalog.source === 'stale-cache' ? 'stale' : 'error'}
                    title={catalog.source === 'stale-cache' ? 'Đang hiện cache cũ' : 'Không tải được cửa hàng'}
                    message={catalog.error.message}
                    onRetry={onRetry}
                />
            )}
            {catalog?.truncated && catalog.source === 'network' && (
                <NoticeBanner
                    kind="warning"
                    title="Danh sách bị cắt"
                    message="Danh sách chưa tải đủ trang; một số sản phẩm có thể chưa hiển thị."
                />
            )}
            <div className="md:flex md:gap-6 lg:gap-8">
            {groups.length > 0 && <CategorySidebar {...navProps} />}
            <div className="flex-1 min-w-0 space-y-4">
            {!isHome && <Breadcrumb label={activeLabel} onHome={() => select('ALL')} />}
            <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {productsTitle}
                </h2>
                <span className="flex-none text-slate-500 dark:text-slate-300 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {filteredProducts.length} sản phẩm
                </span>
            </div>

            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredProducts.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            categoryLabel={categoryLabels.get(product.category)}
                            onClick={setSelectedProduct}
                        />
                    ))}
                </div>
            ) : loading ? null : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-slate-100 p-6 rounded-full mb-4">
                        <Search size={48} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Không tìm thấy sản phẩm</h3>
                    <p className="text-slate-500 max-w-md">
                        Rất tiếc, chúng tôi không tìm thấy sản phẩm nào phù hợp với từ khóa "{searchTerm}".
                    </p>
                    <button
                        onClick={() => setSearchTerm('')}
                        className="mt-6 text-primary-600 font-medium hover:underline"
                    >
                        Xóa bộ lọc tìm kiếm
                    </button>
                </div>
            )}
            </div>
            </div>
        </main>
    );
};
