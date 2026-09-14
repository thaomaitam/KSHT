import { stripCostFromProduct } from "./giabanPayloads.ts";
import type { Product } from "../types.ts";

export const STOREFRONT_CACHE_TTL_MS = 10 * 60 * 1000;
export const STOREFRONT_CACHE_JITTER = 0.3;
export const STOREFRONT_PRODUCTS_KEY = "giaban_products";
export const STOREFRONT_CATEGORIES_KEY = "giaban_categories";

export const storefrontCacheClock = {
  now: () => Date.now(),
  random: () => Math.random(),
};

export const storefrontCacheTtlMs = (random = storefrontCacheClock.random()): number => {
  const jitter = (random * 2 - 1) * STOREFRONT_CACHE_JITTER;
  return Math.round(STOREFRONT_CACHE_TTL_MS * (1 + jitter));
};

type Envelope<T> = { v: 1; expiresAt: number; items: T };

const isProductList = (value: unknown): value is Product[] => Array.isArray(value);

export const readStorefrontEnvelope = <T>(
  key: string,
  isItems: (value: unknown) => value is T,
): { items: T; fresh: boolean } | null => {
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    const now = storefrontCacheClock.now();
    if (parsed && parsed.v === 1 && typeof parsed.expiresAt === "number" && isItems(parsed.items)) {
      return { items: parsed.items, fresh: parsed.expiresAt > now };
    }
    if (isItems(parsed)) return { items: parsed, fresh: false };
    return null;
  } catch {
    return null;
  }
};

export const writeStorefrontEnvelope = <T>(key: string, items: T): void => {
  const envelope: Envelope<T> = {
    v: 1,
    expiresAt: storefrontCacheClock.now() + storefrontCacheTtlMs(),
    items,
  };
  try {
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // quota
  }
};

export const readPublicProductCache = (): { products: Product[]; fresh: boolean } | null => {
  const hit = readStorefrontEnvelope(STOREFRONT_PRODUCTS_KEY, isProductList);
  if (!hit) return null;
  return { products: hit.items.map(stripCostFromProduct), fresh: hit.fresh };
};

export const writePublicProductCache = (products: Product[]): void => {
  writeStorefrontEnvelope(STOREFRONT_PRODUCTS_KEY, products.map(stripCostFromProduct));
};

export const stripPublicProductCacheCosts = (): void => {
  const stored = localStorage.getItem(STOREFRONT_PRODUCTS_KEY);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    if (parsed && parsed.v === 1 && Array.isArray(parsed.items)) {
      localStorage.setItem(STOREFRONT_PRODUCTS_KEY, JSON.stringify({
        ...parsed,
        items: parsed.items.map((product: Product) => stripCostFromProduct(product)),
      }));
      return;
    }
    if (Array.isArray(parsed)) {
      localStorage.setItem(STOREFRONT_PRODUCTS_KEY, JSON.stringify(parsed.map((product: Product) => stripCostFromProduct(product))));
      return;
    }
    localStorage.removeItem(STOREFRONT_PRODUCTS_KEY);
  } catch {
    localStorage.removeItem(STOREFRONT_PRODUCTS_KEY);
  }
};
