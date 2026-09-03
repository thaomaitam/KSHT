import { Product } from './types';
import { PRODUCTS } from './constants';
import { apiService } from './apiService';

const STORAGE_KEY = 'giaban_products';

export const storageService = {
  // Get products from Cloud API first, fallback to localStorage
  async getProducts(): Promise<Product[]> {
    // Always try Cloud API first (default data source)
    const remote = await apiService.get<Product[]>('products');
    if (remote && remote.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      return remote;
    }

    // Fallback to localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return PRODUCTS;
      }
    }
    // Initialize with default products
    await this.saveProducts(PRODUCTS);
    return PRODUCTS;
  },

  // Save products to localStorage
  async saveProducts(products: Product[]): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    await apiService.save('products', products);
  },

  // Add a new product
  async addProduct(product: Product): Promise<Product[]> {
    const products = await this.getProducts();
    const newProducts = [...products, product];
    await this.saveProducts(newProducts);
    return newProducts;
  },

  // Update an existing product
  async updateProduct(updatedProduct: Product): Promise<Product[]> {
    const products = await this.getProducts();
    const index = products.findIndex(p => p.id === updatedProduct.id);
    if (index !== -1) {
      products[index] = updatedProduct;
      await this.saveProducts(products);
    }
    return products;
  },

  // Delete a product
  async deleteProduct(productId: string): Promise<Product[]> {
    const products = await this.getProducts();
    const filtered = products.filter(p => p.id !== productId);
    await this.saveProducts(filtered);
    return filtered;
  },

  // Generate a unique ID
  generateId(): string {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  // Reset to default products
  async resetToDefault(): Promise<Product[]> {
    await this.saveProducts(PRODUCTS);
    return PRODUCTS;
  }
};

