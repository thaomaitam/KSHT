import { Product } from './types';
import { PRODUCTS } from './constants';
import { apiService } from './apiService';
import { giabanClient, newIdempotencyKey } from './client/giabanClient';
import { settingsService } from './settingsService';

const STORAGE_KEY = 'giaban_products';

const cacheProducts = (products: Product[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    // quota
  }
};

const readCache = (): Product[] | null => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

const categoryIdFromValue = async (value: string): Promise<string> => {
  const categories = await settingsService.getCategories();
  return categories.find((category) => category.value === value || category.id === value)?.id || value;
};

const toUiProduct = (row: any, withCost: boolean, categoryById: Map<string, string>): Product => ({
  id: String(row.id),
  name: String(row.name),
  category: (categoryById.get(String(row.categoryId || row.category)) || row.categoryId || row.category) as Product['category'],
  description: String(row.description || ''),
  image: String(row.image || ''),
  isHot: Boolean(row.isHot),
  variants: (row.variants || []).map((variant: any) => ({
    size: String(variant.size || ''),
    unit: String(variant.unit || ''),
    price: Number(variant.price) || 0,
    ...(withCost && variant.costPrice !== undefined ? { costPrice: Number(variant.costPrice) || 0 } : {}),
  })),
  revision: Number(row.revision) || 1,
});

const categoryMap = async (): Promise<Map<string, string>> => {
  const categories = await settingsService.getCategories();
  return new Map(categories.map((category) => [category.id, category.value]));
};

export const storageService = {
  async getStorefrontProducts(): Promise<Product[]> {
    try {
      const page = await giabanClient.getPublicProducts();
      const byId = await categoryMap();
      const products = giabanClient.itemsOf(page).map((row) => toUiProduct(row, false, byId));
      cacheProducts(products);
      return products;
    } catch {
      return readCache() || PRODUCTS;
    }
  },

  async getAdminProducts(): Promise<Product[]> {
    const page = await giabanClient.listProducts();
    const byId = await categoryMap();
    const products = giabanClient.itemsOf(page).map((row) => toUiProduct(row, true, byId));
    cacheProducts(products);
    return products;
  },

  async getProducts(): Promise<Product[]> {
    return apiService.getSessionToken() ? this.getAdminProducts() : this.getStorefrontProducts();
  },

  async addProduct(product: Product): Promise<Product[]> {
    const categoryId = await categoryIdFromValue(String(product.category));
    await giabanClient.createProduct({
      name: product.name,
      categoryId,
      description: product.description,
      image: product.image,
      isHot: Boolean(product.isHot),
      variants: (product.variants || []).map((variant) => ({
        size: variant.size,
        unit: variant.unit,
        price: variant.price,
        costPrice: variant.costPrice || 0,
      })),
    }, newIdempotencyKey());
    return this.getAdminProducts();
  },

  async updateProduct(updatedProduct: Product): Promise<Product[]> {
    const categoryId = await categoryIdFromValue(String(updatedProduct.category));
    await giabanClient.updateProduct(updatedProduct.id, {
      name: updatedProduct.name,
      categoryId,
      description: updatedProduct.description,
      image: updatedProduct.image,
      isHot: Boolean(updatedProduct.isHot),
      variants: (updatedProduct.variants || []).map((variant) => ({
        size: variant.size,
        unit: variant.unit,
        price: variant.price,
        costPrice: variant.costPrice || 0,
      })),
    }, updatedProduct.revision || 1, newIdempotencyKey());
    return this.getAdminProducts();
  },

  async deleteProduct(productId: string): Promise<Product[]> {
    await giabanClient.archiveProduct(productId, newIdempotencyKey());
    return this.getAdminProducts();
  },

  generateId(): string {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
};
