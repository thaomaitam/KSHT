import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Product, ProductVariant } from './types';

const CART_STORAGE_KEY = 'giaban_cart';

// Cart item with product info and selected variant
export interface CartItem {
    productId: string;
    productName: string;
    productImage: string;
    variant: ProductVariant;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (product: Product, variant: ProductVariant) => void;
    removeFromCart: (productId: string, variantSize: string) => void;
    updateQuantity: (productId: string, variantSize: string, quantity: number) => void;
    clearCart: () => void;
    getTotalItems: () => number;
    getTotalPrice: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Load cart from localStorage
const loadCartFromStorage = (): CartItem[] => {
    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading cart from storage:', error);
    }
    return [];
};

// Save cart to localStorage
const saveCartToStorage = (items: CartItem[]) => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
        console.error('Error saving cart to storage:', error);
    }
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());

    // Save to localStorage whenever items change
    useEffect(() => {
        saveCartToStorage(items);
    }, [items]);

    const addToCart = useCallback((product: Product, variant: ProductVariant) => {
        setItems(prev => {
            const existing = prev.find(
                item => item.productId === product.id && item.variant.size === variant.size
            );

            if (existing) {
                return prev.map(item =>
                    item.productId === product.id && item.variant.size === variant.size
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }

            const publicVariant = {
                size: variant.size,
                unit: variant.unit,
                price: variant.price,
            };
            return [...prev, {
                productId: product.id,
                productName: product.name,
                productImage: product.image,
                variant: publicVariant,
                quantity: 1,
            }];
        });
    }, []);

    const removeFromCart = useCallback((productId: string, variantSize: string) => {
        setItems(prev => prev.filter(
            item => !(item.productId === productId && item.variant.size === variantSize)
        ));
    }, []);

    const updateQuantity = useCallback((productId: string, variantSize: string, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(productId, variantSize);
            return;
        }
        setItems(prev => prev.map(item =>
            item.productId === productId && item.variant.size === variantSize
                ? { ...item, quantity }
                : item
        ));
    }, [removeFromCart]);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const getTotalItems = useCallback(() => {
        return items.reduce((total, item) => total + item.quantity, 0);
    }, [items]);

    const getTotalPrice = useCallback(() => {
        return items.reduce((total, item) => total + (item.variant.price * item.quantity), 0);
    }, [items]);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            getTotalItems,
            getTotalPrice,
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = (): CartContextType => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};
