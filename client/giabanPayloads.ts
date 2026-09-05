import { assertVnd } from "../server/domain/money.ts";
import { assertFactor } from "../server/domain/quantity.ts";

import type { Product, ProductVariant } from "../types.ts";

const PAYMENT_METHODS = new Set(["cod", "banking", "cash", "other"]);
const ORDER_PAYMENT_METHODS = new Set(["cod", "banking"]);

export const assertSafeVnd = (value: unknown, field: string): number => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new Error(`${field} must be a non-negative safe integer`);
};

const assertMoneyVnd = (value: unknown, field: string): number => {
  try {
    return assertVnd(value, field);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${field} must be a non-negative VND amount`);
  }
};

const assertQuantityFactor = (value: unknown, field: string): number => {
  try {
    return assertFactor(value, field);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${field} must be a non-negative quantity factor`);
  }
};

const requiredText = (value: unknown, field: string): string => {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return String(value ?? "");
};

export const toProductWrite = (input: {
  name?: string;
  categoryId?: string;
  description?: string;
  image?: string;
  isHot?: boolean;
  variants?: Array<{ size?: string; unit?: string; price?: number; costPrice?: number }>;
}) => {
  const variants = Array.isArray(input.variants) ? input.variants : [];
  if (variants.length < 1) throw new Error("Product requires at least one variant");
  return {
    name: requiredText(input.name, "name"),
    categoryId: requiredText(input.categoryId, "categoryId"),
    description: String(input.description ?? ""),
    image: String(input.image ?? ""),
    isHot: Boolean(input.isHot),
    variants: variants.map((variant) => ({
      size: requiredText(variant.size, "size"),
      unit: requiredText(variant.unit, "unit"),
      price: assertSafeVnd(variant.price, "price"),
      costPrice: assertSafeVnd(variant.costPrice ?? 0, "costPrice"),
    })),
  };
};

export const toDraftOrderWrite = (input: {
  customerId?: string;
  contactSnapshot?: { name?: string; phone?: string; address?: string };
  items?: Array<{
    productId?: string | null;
    name?: string;
    unit?: string;
    quantity?: number;
    soCuon?: number | null;
    soKi?: number | null;
    unitPrice?: number;
    costPrice?: number;
    isManual?: boolean;
  }>;
  shippingFee?: number;
  discount?: number;
  note?: string;
  shopTemplateId?: string;
  totalAmountInWords?: string;
  paymentMethod?: string;
}) => {
  const customerId = requiredText(input.customerId, "customerId");
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length < 1) throw new Error("An order requires at least one line");
  const payload: Record<string, unknown> = {
    customerId,
    items: items.map((item) => ({
      productId: item.productId ? String(item.productId) : null,
      name: requiredText(item.name, "name"),
      unit: requiredText(item.unit, "unit"),
      quantity: (() => {
        const quantity = assertSafeVnd(item.quantity, "quantity");
        if (quantity < 1) throw new Error("quantity must be a positive safe integer");
        return quantity;
      })(),
      soCuon: item.soCuon == null || item.soCuon === 0 ? null : assertQuantityFactor(item.soCuon, "soCuon"),
      soKi: item.soKi == null || item.soKi === 0 ? null : assertQuantityFactor(item.soKi, "soKi"),
      unitPrice: assertMoneyVnd(item.unitPrice, "unitPrice"),
      costPrice: assertMoneyVnd(item.costPrice ?? 0, "costPrice"),
      isManual: Boolean(item.isManual),
    })),
    shippingFee: assertMoneyVnd(input.shippingFee ?? 0, "shippingFee"),
    discount: assertMoneyVnd(input.discount ?? 0, "discount"),
    note: String(input.note ?? ""),
  };
  if (input.contactSnapshot) {
    payload.contactSnapshot = {
      name: requiredText(input.contactSnapshot.name, "contact.name"),
      phone: requiredText(input.contactSnapshot.phone, "contact.phone"),
      address: requiredText(input.contactSnapshot.address, "contact.address"),
    };
  }
  if (input.shopTemplateId) payload.shopTemplateId = String(input.shopTemplateId);
  if (input.totalAmountInWords) payload.totalAmountInWords = String(input.totalAmountInWords);
  if (input.paymentMethod) {
    if (!ORDER_PAYMENT_METHODS.has(input.paymentMethod)) throw new Error("paymentMethod is invalid");
    payload.paymentMethod = input.paymentMethod;
  }
  return payload as {
    customerId: string;
    items: Array<{
      productId: string | null;
      name: string;
      unit: string;
      quantity: number;
      soCuon: number | null;
      soKi: number | null;
      unitPrice: number;
      costPrice: number;
      isManual: boolean;
    }>;
    shippingFee: number;
    discount: number;
    note: string;
    contactSnapshot?: { name: string; phone: string; address: string };
    shopTemplateId?: string;
    totalAmountInWords?: string;
    paymentMethod?: string;
  };
};

export const toPaymentWrite = (input: { amount?: number; method?: string; note?: string }) => {
  const amount = assertMoneyVnd(input.amount, "amount");
  if (amount <= 0) throw new Error("amount must be greater than 0");
  const method = String(input.method || "cash");
  if (!PAYMENT_METHODS.has(method)) throw new Error("method is invalid");
  const payload: { amount: number; method: string; note?: string } = { amount, method };
  if (input.note) payload.note = String(input.note);
  return payload;
};

export const toCustomerWrite = (input: { name?: string; phone?: string; address?: string }) => ({
  name: requiredText(input.name, "name"),
  phone: requiredText(input.phone, "phone"),
  address: requiredText(input.address, "address"),
});

export const toCategoryWrite = (input: { label?: string; value?: string }) => {
  const payload: { label: string; value?: string } = { label: requiredText(input.label, "label") };
  if (input.value) payload.value = String(input.value);
  return payload;
};

export const toBankSettingsWrite = (input: {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  qrCodeUrl?: string;
}) => ({
  bankName: String(input.bankName ?? ""),
  accountNumber: String(input.accountNumber ?? ""),
  accountName: String(input.accountName ?? ""),
  qrCodeUrl: String(input.qrCodeUrl ?? ""),
});

export const toPhoneSettingsWrite = (input: { phoneNumber?: string }) => ({
  phoneNumber: requiredText(input.phoneNumber, "phoneNumber"),
});

export const toTaxSettingsWrite = (input: { rate?: number }) => {
  const rate = assertSafeVnd(input.rate ?? 0, "rate");
  if (rate > 100) throw new Error("rate must be between 0 and 100");
  return { rate };
};

export const toShopTemplateWrite = (input: {
  name?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
}) => ({
  name: requiredText(input.name, "name"),
  address: String(input.address ?? ""),
  phone: String(input.phone ?? ""),
  isDefault: Boolean(input.isDefault),
});

export const toCashTransactionWrite = (input: {
  type?: string;
  amount?: number;
  description?: string;
  category?: string;
  date?: string;
}) => {
  if (input.type !== "income" && input.type !== "expense") throw new Error("type is invalid");
  return {
    type: input.type,
    amount: assertSafeVnd(input.amount, "amount"),
    description: requiredText(input.description, "description"),
    category: String(input.category ?? ""),
    date: String(input.date ?? ""),
  };
};

export const toReportRangeQuery = (fromDate: string, toDate: string): string => {
  const search = new URLSearchParams();
  search.set("fromDate", fromDate);
  search.set("toDate", toDate);
  return search.toString();
};

export const stripCostFromVariant = (variant: ProductVariant): ProductVariant => ({
  size: String(variant.size || ""),
  unit: String(variant.unit || ""),
  price: Number(variant.price) || 0,
});

export const stripCostFromProduct = (product: Product): Product => ({
  ...product,
  variants: (product.variants || []).map(stripCostFromVariant),
});
