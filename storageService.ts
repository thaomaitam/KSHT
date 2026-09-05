import type { CatalogLoad, Product } from './types.ts';
import { giabanClient, newIdempotencyKey, CloudWriteError } from './client/giabanClient.ts';
import { collectPages } from './client/giabanPage.ts';
import { stripCostFromProduct, toProductWrite } from './client/giabanPayloads.ts';
import { settingsService } from './settingsService.ts';
import { apiService, PUBLIC_PRODUCTS_CACHE_KEY } from './apiService.ts';

const cacheJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota
  }
};

const readCache = (key: string): Product[] | null => {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const categoryIdFromValue = async (value: string): Promise<string> => {
  const categories = await settingsService.getCategories();
  return categories.find((category) => category.value === value || category.id === value)?.id || value;
};

const toUiProduct = (row: any, withCost: boolean, categoryById: Map<string, string>): Product => {
  const product: Product = {
    id: String(row.id),
    name: String(row.name),
    category: (categoryById.get(String(row.categoryId || row.category)) || row.categoryId || row.category) as Product['category'],
    description: String(row.description || ''),
    image: String(row.image || ''),
    isHot: Boolean(row.isHot),
    variants: (row.variants || []).map((variant: any) => {
      const mapped = {
        size: String(variant.size || ''),
        unit: String(variant.unit || ''),
        price: Number(variant.price) || 0,
      };
      if (!withCost) return mapped;
      return { ...mapped, costPrice: Number(variant.costPrice) || 0 };
    }),
    revision: Number(row.revision) || 1,
  };
  return withCost ? product : stripCostFromProduct(product);
};

const categoryMap = async (): Promise<Map<string, string>> => {
  const categories = await settingsService.getCategories();
  return new Map(categories.map((category) => [category.id, category.value]));
};

const asError = (error: unknown): { message: string; retryable: boolean } => {
  if (error instanceof CloudWriteError) {
    return { message: error.message, retryable: error.retryable || error.code === 'OFFLINE' };
  }
  return { message: error instanceof Error ? error.message : 'Không tải được dữ liệu', retryable: true };
};

export const storageService = {
  async getStorefrontProducts(): Promise<CatalogLoad> {
    try {
      const collected = await collectPages((cursor) => giabanClient.getPublicProducts({ cursor }));
      const byId = await categoryMap();
      const products = collected.items.map((row) => toUiProduct(row, false, byId)).map(stripCostFromProduct);
      cacheJson(PUBLIC_PRODUCTS_CACHE_KEY, products);
      return { products, truncated: collected.truncated, source: 'network' };
    } catch (error) {
      const cached = (readCache(PUBLIC_PRODUCTS_CACHE_KEY) || []).map(stripCostFromProduct);
      if (cached.length) {
        return { products: cached, truncated: true, source: 'stale-cache', error: asError(error) };
      }
      return { products: [], truncated: false, source: 'empty', error: asError(error) };
    }
  },

  async getAdminProducts(): Promise<CatalogLoad> {
    const session = apiService.getSessionToken();
    if (!session) throw new CloudWriteError('Cần đăng nhập lại.', { code: 'UNAUTHENTICATED', status: 401 });
    const collected = await collectPages((cursor) => giabanClient.listProducts({ cursor }));
    const byId = await categoryMap();
    const products = collected.items.map((row) => toUiProduct(row, true, byId));
    if (apiService.getSessionToken() !== session) {
      throw new CloudWriteError('Phiên đã đổi trong lúc tải dữ liệu.', { code: 'UNAUTHENTICATED', status: 401 });
    }
    // Private costs stay in the mounted admin view, never persistent localStorage.
    return { products, truncated: collected.truncated, source: 'network' };
  },

  async addProduct(product: Product): Promise<CatalogLoad> {
    const categoryId = await categoryIdFromValue(String(product.category));
    await giabanClient.createProduct(toProductWrite({
      name: product.name,
      categoryId,
      description: product.description,
      image: product.image,
      isHot: Boolean(product.isHot),
      variants: product.variants,
    }), newIdempotencyKey());
    return this.getAdminProducts();
  },

  async updateProduct(updatedProduct: Product): Promise<CatalogLoad> {
    const categoryId = await categoryIdFromValue(String(updatedProduct.category));
    await giabanClient.updateProduct(updatedProduct.id, toProductWrite({
      name: updatedProduct.name,
      categoryId,
      description: updatedProduct.description,
      image: updatedProduct.image,
      isHot: Boolean(updatedProduct.isHot),
      variants: updatedProduct.variants,
    }), updatedProduct.revision || 1, newIdempotencyKey());
    return this.getAdminProducts();
  },

  async deleteProduct(productId: string, revision?: number): Promise<CatalogLoad> {
    await giabanClient.archiveProduct(productId, newIdempotencyKey(), revision);
    return this.getAdminProducts();
  },

  generateId(): string {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
};
