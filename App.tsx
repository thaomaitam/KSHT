import React from 'react';
import { ProductModal } from './components/ProductModal';
import { AdminPage } from './components/AdminPage';
import { AdminSettings } from './components/AdminSettings';
import { BusinessPage } from './components/BusinessPage';
import { LoginModal } from './components/LoginModal';
import { CartDrawer } from './components/CartDrawer';
import { CartProvider } from './CartContext';
import { useAppData } from './hooks/useAppData';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ProductList } from './components/ProductList';

const MainApp: React.FC = () => {
  const {
    activeCategory, setActiveCategory, searchTerm, setSearchTerm,
    selectedProduct, setSelectedProduct, currentPage, categories,
    showLoginModal, setShowLoginModal, showCart, setShowCart,
    filteredProducts, handleLoginSuccess
  } = useAppData();

  if (currentPage === 'admin') return <AdminPage />;
  if (currentPage === 'settings') return <AdminSettings />;
  if (currentPage === 'business') return <BusinessPage />;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 font-sans text-slate-900 dark:text-slate-100">
      <Header
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categories={categories}
        setShowCart={setShowCart}
        setShowLoginModal={setShowLoginModal}
        currentPage={currentPage}
      />

      <ProductList
        filteredProducts={filteredProducts}
        activeCategory={activeCategory}
        categories={categories}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setSelectedProduct={setSelectedProduct}
      />

      <Footer />

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {showLoginModal && (
        <LoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      <CartDrawer
        isOpen={showCart}
        onClose={() => setShowCart(false)}
      />
    </div>
  );
};

const App: React.FC = () => (
  <CartProvider>
    <MainApp />
  </CartProvider>
);

export default App;