import React from 'react';
import { Search } from 'lucide-react';
import { CatalogLoad, Product } from '../types';
import { ProductCard } from './ProductCard';
import { CategoryItem } from '../settingsService';
import { NoticeBanner } from './NoticeBanner';

interface ProductListProps {
    filteredProducts: Product[];
    activeCategory: string;
    categories: CategoryItem[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
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
    setSelectedProduct, catalog, loading, onRetry
}) => {
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
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                    {activeCategory === 'ALL' ? 'Tất cả sản phẩm' : categories.find(c => c.value === activeCategory)?.label}
                </h2>
                <span className="text-slate-500 text-sm font-medium bg-slate-100 px-3 py-1 rounded-full">
                    {filteredProducts.length} sản phẩm
                </span>
            </div>

            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
                    {filteredProducts.map(product => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onClick={setSelectedProduct}
                        />
                    ))}
                </div>
            ) : (
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
        </main>
    );
};
