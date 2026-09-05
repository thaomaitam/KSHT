import { apiService, SESSION_ENDED_EVENT } from '../apiService';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { CatalogLoad, Product } from '../types';
import { storageService } from '../storageService';
import { settingsService, CategoryItem } from '../settingsService';
import { isAdminAuthenticated } from '../components/LoginModal';
import { searchProducts } from '../utils/searchUtils';

export type PageType = 'main' | 'admin' | 'settings' | 'business';

const emptyCatalog = (): CatalogLoad => ({ products: [], truncated: false, source: 'empty' });

export const useAppData = () => {
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [currentPage, setCurrentPage] = useState<PageType>('main');
    const [catalog, setCatalog] = useState<CatalogLoad>(emptyCatalog);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showCart, setShowCart] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadStorefront = useCallback(async () => {
        setLoading(true);
        try {
            const [prods, cats] = await Promise.all([
                storageService.getStorefrontProducts(),
                settingsService.getCategoryLoad(),
            ]);
            setCatalog(prods);
            setCategories(cats.categories);
        } catch (error) {
            setCatalog({
                products: [],
                truncated: false,
                source: 'empty',
                error: { message: error instanceof Error ? error.message : 'Không tải được cửa hàng', retryable: true },
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handleHashChange = async () => {
            const hash = window.location.hash;
            if (hash === '#/admin') {
                if (isAdminAuthenticated()) {
                    setCurrentPage('admin');
                } else {
                    window.location.hash = '#/';
                    setShowLoginModal(true);
                }
            } else if (hash === '#/admin/settings') {
                if (isAdminAuthenticated()) {
                    setCurrentPage('settings');
                } else {
                    window.location.hash = '#/';
                    setShowLoginModal(true);
                }
            } else if (hash === '#/admin/business') {
                if (isAdminAuthenticated()) {
                    setCurrentPage('business');
                } else {
                    window.location.hash = '#/';
                    setShowLoginModal(true);
                }
            } else {
                setCurrentPage('main');
                await loadStorefront();
            }
        };

        void handleHashChange();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [loadStorefront]);

    useEffect(() => {
        const handleOpenCart = () => setShowCart(true);
        window.addEventListener('open-cart', handleOpenCart);
        return () => window.removeEventListener('open-cart', handleOpenCart);
    }, []);

    useEffect(() => {
        if (currentPage === 'main') void loadStorefront();
    }, [currentPage, loadStorefront]);

    useEffect(() => {
        const onSessionEnded = () => {
            setSelectedProduct(null);
            setCurrentPage('main');
            window.location.hash = '#/';
            setShowLoginModal(true);
        };
        const checkSession = () => { if (currentPage !== 'main') apiService.getSessionToken(); };
        window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
        window.addEventListener('focus', checkSession);
        const timer = window.setInterval(checkSession, 30_000);
        return () => {
            window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
            window.removeEventListener('focus', checkSession);
            window.clearInterval(timer);
        };
    }, [currentPage]);

    const filteredProducts = useMemo(() => {
        return searchProducts(catalog.products, searchTerm, activeCategory);
    }, [activeCategory, searchTerm, catalog.products]);

    const handleLoginSuccess = () => {
        setShowLoginModal(false);
        window.location.hash = '#/admin';
    };

    return {
        activeCategory,
        setActiveCategory,
        searchTerm,
        setSearchTerm,
        selectedProduct,
        setSelectedProduct,
        currentPage,
        setCurrentPage,
        products: catalog.products,
        catalog,
        loading,
        reloadStorefront: loadStorefront,
        categories,
        showLoginModal,
        setShowLoginModal,
        showCart,
        setShowCart,
        filteredProducts,
        handleLoginSuccess
    };
};
