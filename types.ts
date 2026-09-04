export interface ProductVariant {
  size: string;
  unit: string;
  price: number;
  costPrice?: number;
}

export type Category = 'ALL' | 'PAINT_BRUSH' | 'ROLLER' | 'ACCESSORY';

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