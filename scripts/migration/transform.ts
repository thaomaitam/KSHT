export interface KvSnapshot {
  products?: unknown[];
  categories?: unknown[];
  customers?: unknown[];
  orders?: unknown[];
  costPrices?: Record<string, number>;
  transactions?: unknown[];
  shopTemplates?: unknown[];
  bankInfo?: Record<string, unknown>;
  taxRate?: number;
  settings?: Record<string, unknown>;
}

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];

const money = (value: unknown): number => {
  const amount = Number(value ?? 0);
  if (!Number.isSafeInteger(amount) || amount < 0) return 0;
  return amount;
};

export const transformKvSnapshot = (snapshot: KvSnapshot) => {
  const costPrices = snapshot.costPrices ?? {};
  const products = asArray(snapshot.products).map((product, index) => ({
    id: String(product.id ?? `prd_migrated_${index}`),
    name: String(product.name ?? ""),
    categoryId: String(product.category ?? product.categoryId ?? ""),
    description: String(product.description ?? ""),
    image: String(product.image ?? ""),
    isHot: Boolean(product.isHot),
    archived: false,
    revision: 1,
    variants: asArray(product.variants).map((variant) => ({
      size: String(variant.size ?? ""),
      unit: String(variant.unit ?? ""),
      price: money(variant.price),
      costPrice: money(variant.costPrice ?? costPrices[String(product.id)]),
    })),
  }));
  const categories = asArray(snapshot.categories).map((category, index) => ({
    id: String(category.id ?? `cat_migrated_${index}`),
    label: String(category.label ?? category.name ?? ""),
    value: String(category.value ?? category.id ?? ""),
    archived: false,
    revision: 1,
  }));
  const customers = asArray(snapshot.customers).map((customer, index) => ({
    id: String(customer.id ?? customer.customerId ?? `cus_migrated_${index}`),
    name: String(customer.name ?? ""),
    phone: String(customer.phone ?? ""),
    address: String(customer.address ?? ""),
    archived: false,
    revision: 1,
    mergedIntoId: null,
  }));
  const orders = asArray(snapshot.orders).map((order, index) => ({
    id: String(order.id ?? `ord_migrated_${index}`),
    customerId: String(order.customerId ?? ""),
    contact: {
      name: String(order.customerName ?? order.name ?? ""),
      phone: String(order.phone ?? ""),
      address: String(order.address ?? ""),
    },
    status: "draft",
    discount: money(order.discount),
    shippingFee: money(order.shippingFee),
    items: asArray(order.items),
    note: String(order.note ?? ""),
    paymentMethod: order.paymentMethod === "banking" ? "banking" : "cod",
    revision: 1,
  }));
  return {
    schemaVersion: "1.0.0",
    products,
    categories,
    customers,
    orders,
    warnings: orders.filter((order) => !order.customerId).map((order) => `Order ${order.id} missing customerId`),
  };
};
