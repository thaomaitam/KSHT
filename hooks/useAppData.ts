import { useState, useMemo, useEffect } from 'react';
import { Product } from '../types';
import { storageService, initializeData } from '../storageService';
import { settingsService, CategoryItem } from '../settingsService';
import { isAdminAuthenticated } from '../components/LoginModal';

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

        const init = async () => {
            await handleHashChange();
            await initializeData();
            const prods = await storageService.getProducts();
            const cats = await settingsService.getCategories();
            setProducts(prods);
            setCategories(cats);
        };
        init();

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
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
        return products.filter(product => {
            const matchesCategory = activeCategory === 'ALL' || product.category === activeCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
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
