export interface ProductVariant {
  size: string;
  unit: string;
  price: number;
  costPrice?: number;
}

export type Category = string;

export interface Product {
  id: string;
  name: string;
  category: Category;
  description: string;
  image: string;
  variants: ProductVariant[];
  isHot?: boolean;
  revision?: number;
}

export type LoadSource = 'network' | 'stale-cache' | 'empty';

export interface CatalogLoad {
  products: Product[];
  truncated: boolean;
  source: LoadSource;
  error?: { message: string; retryable: boolean };
}
