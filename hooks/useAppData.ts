import { useState, useMemo, useEffect } from 'react';
import { Product } from '../types';
import { storageService } from '../storageService';
import { settingsService, CategoryItem } from '../settingsService';
import { isAdminAuthenticated } from '../components/LoginModal';
import { searchProducts } from '../utils/searchUtils';

export type PageType = 'main' | 'admin' | 'settings' | 'business';

export const useAppData = () => {
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [currentPage, setCurrentPage] = useState<PageType>('main');
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showCart, setShowCart] = useState(false);

    // Handle hash-based routing
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
                const prods = await storageService.getProducts();
                const cats = await settingsService.getCategories();
                setProducts(prods);
                setCategories(cats);
            }
        };

        void handleHashChange();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Listen for open-cart event from ProductModal
    useEffect(() => {
        const handleOpenCart = () => setShowCart(true);
        window.addEventListener('open-cart', handleOpenCart);
        return () => window.removeEventListener('open-cart', handleOpenCart);
    }, []);

    // Reload products when switching back to main
    useEffect(() => {
        const loadProducts = async () => {
            if (currentPage === 'main') {
                const prods = await storageService.getProducts();
                setProducts(prods);
            }
        };
        loadProducts();
    }, [currentPage]);

    const filteredProducts = useMemo(() => {
        return searchProducts(products, searchTerm, activeCategory);
    }, [activeCategory, searchTerm, products]);

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
        products,
        categories,
        showLoginModal,
        setShowLoginModal,
        showCart,
        setShowCart,
        filteredProducts,
        handleLoginSuccess
    };
};
