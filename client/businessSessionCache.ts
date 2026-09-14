import type { Product } from "../types.ts";
import type {
  BankInfo,
  Customer,
  HistoricalReview,
  Order,
  ReportSummary,
  ShopTemplate,
  Transaction,
} from "../businessService.ts";

export type BusinessSessionSnapshot = {
  orders: Order[];
  ordersTruncated: boolean;
  customers: Customer[];
  customersTruncated: boolean;
  transactions: Transaction[];
  products: Product[];
  productsTruncated: boolean;
  bankInfo: BankInfo | null;
  shopTemplates: ShopTemplate[];
  report: ReportSummary | null;
  review: HistoricalReview | null;
};

let snapshot: BusinessSessionSnapshot | null = null;

export const getBusinessSessionCache = (): BusinessSessionSnapshot | null => snapshot;

export const setBusinessSessionCache = (value: BusinessSessionSnapshot): void => {
  snapshot = value;
};

export const clearBusinessSessionCache = (): void => {
  snapshot = null;
};
