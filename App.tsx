import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShoppingBag, Phone, Settings, ShoppingCart, RefreshCw, Lock, Package, BarChart3, Tags } from 'lucide-react';
import { Product } from './types';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { AdminPage } from './components/AdminPage';
import { AdminSettings } from './components/AdminSettings';
import { BusinessPage } from './components/BusinessPage';
import { LoginModal, isAdminAuthenticated } from './components/LoginModal';
import { CartDrawer } from './components/CartDrawer';
import { CartProvider, useCart } from './CartContext';
import { storageService, initializeData } from './storageService';
import { settingsService, CategoryItem } from './settingsService';

// Cart badge component
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

const MainApp: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState<'main' | 'admin' | 'settings' | 'business'>('main');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash === '#/admin') {
        // Check authentication before showing admin
        if (isAdminAuthenticated()) {
          setCurrentPage('admin');
        } else {
          // Redirect back to main and show login
          window.location.hash = '#/';
          setShowLoginModal(true);
        }
      } else if (hash === '#/admin/settings') {
        // Check auth for settings too
        if (isAdminAuthenticated()) {
          setCurrentPage('settings');
        } else {
          window.location.hash = '#/';
          setShowLoginModal(true);
        }
      } else if (hash === '#/admin/business') {
        // Check auth for business page
        if (isAdminAuthenticated()) {
          setCurrentPage('business');
        } else {
          window.location.hash = '#/';
          setShowLoginModal(true);
        }
      } else {
        setCurrentPage('main');
        // Reload products and categories when returning to main page
        const prods = await storageService.getProducts();
        const cats = await settingsService.getCategories();
        setProducts(prods);
        setCategories(cats);
      }
    };

    // Initial check
    const init = async () => {
      await handleHashChange();
      // Initialize data from data.json then load products
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

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isAdminAuthenticated()) {
      window.location.hash = '#/admin';
    } else {
      setShowLoginModal(true);
    }
  };

  // Render Admin Page
  if (currentPage === 'admin') {
    return <AdminPage />;
  }

  // Render Settings Page
  if (currentPage === 'settings') {
    return <AdminSettings />;
  }

  // Render Business Page
  if (currentPage === 'business') {
    return <BusinessPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top Row: Logo, Search, Actions */}
          <div className="flex items-center justify-between h-16 md:h-20 gap-4 md:gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer flex-shrink-0" onClick={() => { setActiveCategory('ALL'); setSearchTerm(''); }}>
              <div className="bg-primary-600 p-2 rounded-xl text-white shadow-lg shadow-primary-200">
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
                className="block w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-2xl leading-5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={settingsService.getZaloLink()}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary-100 font-bold text-sm"
              >
                <Phone size={18} />
                <span className="hidden lg:inline">Liên hệ</span>
              </a>

              <button
                onClick={() => setShowCart(true)}
                className="relative p-2.5 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                title="Giỏ hàng"
              >
                <ShoppingCart size={22} />
                <CartBadge />
              </button>

              {/* Admin Actions */}
              {isAdminAuthenticated() ? (
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                  <button
                    onClick={() => window.location.hash = '#/admin'}
                    className={`p-2 rounded-xl transition-colors ${currentPage === 'admin' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Quản lý sản phẩm"
                  >
                    <Package size={20} />
                  </button>
                  <button
                    onClick={() => window.location.hash = '#/admin/business'}
                    className={`p-2 rounded-xl transition-colors ${currentPage === 'business' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Quản lý kinh doanh"
                  >
                    <BarChart3 size={20} />
                  </button>
                  <button
                    onClick={() => window.location.hash = '#/admin/settings'}
                    className={`p-2 rounded-xl transition-colors ${currentPage === 'settings' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Cài đặt hệ thống"
                  >
                    <Settings size={20} />
                  </button>
                  <button
                    onClick={() => {
                      sessionStorage.removeItem('giaban_admin_auth');
                      window.location.hash = '#/';
                      window.location.reload();
                    }}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
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
          <div className="border-t border-slate-100 py-3">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex-shrink-0 flex items-center gap-2 text-slate-400 pr-2 border-r border-slate-100 mr-1">
                <Tags size={16} />
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Danh mục</span>
              </div>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.value)}
                  className={`flex-none px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 border ${activeCategory === cat.value
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-100 scale-105'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600'
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Search Bar - Visible only on mobile */}
          <div className="md:hidden py-3 border-t border-slate-50">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50/50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="Tìm sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Company Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={24} className="text-primary-600" />
                <span className="text-xl font-bold text-slate-800">Kho Sỉ Huy Thảo</span>
              </div>
              <p className="text-slate-600 text-sm mb-2">
                📍 119/16A Mễ Cốc, Phường 15, Quận 8, TP. Hồ Chí Minh 71800
              </p>
              <div className="text-slate-600 text-sm mb-3 space-y-1">
                <p>📞 <a href="tel:0968844385" className="hover:text-primary-600 transition-colors">096.88.44.385</a> - Ms.Thảo</p>
                <p>📞 <a href="tel:0964727949" className="hover:text-primary-600 transition-colors">0964.727.949</a> - Mr.Huy</p>
              </div>
              <p className="text-slate-500 text-xs">
                © 2024 Giaban App. Chuyên cung cấp dụng cụ sơn chất lượng cao.
              </p>
            </div>
            {/* Google Map */}
            <div className="w-full lg:w-auto">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3920.168636043297!2d106.62734977457428!3d10.721473160205868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b05aa037fab%3A0x19e09ad5c2bcaa2!2zS2hvIFPhu4kgSHV5IFRo4bqjbw!5e0!3m2!1svi!2s!4v1765289921148!5m2!1svi!2s"
                width="300"
                height="150"
                style={{ border: 0, borderRadius: '12px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="shadow-md"
              />
            </div>
          </div>
        </div>
      </footer>

      {/* Modal */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={showCart}
        onClose={() => setShowCart(false)}
      />
    </div>
  );
};

// Wrap with CartProvider
const App: React.FC = () => (
  <CartProvider>
    <MainApp />
  </CartProvider>
);

export default App;