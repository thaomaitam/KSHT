import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import type { MemoryStore } from "../../server/persistence/memory/store.ts";
import { transformKvSnapshot, type KvSnapshot } from "./transform.ts";

export interface ReconciliationReport {
  products: number;
  categories: number;
  customers: number;
  orders: number;
  warnings: string[];
}

export const importKvSnapshot = async (store: MemoryStore, snapshot: KvSnapshot): Promise<ReconciliationReport> => {
  const transformed = transformKvSnapshot(snapshot);
  const app = new GiabanApplication(store);
  const context = ownerContext();
  const categoryIds = new Map<string, string>();
  for (const [index, category] of transformed.categories.entries()) {
    const created = await app.execute({
      operationId: "createCategory",
      input: { label: category.label || category.value || `Category ${index}`, value: category.value },
    }, { ...context, idempotencyKey: `mig-cat-${index}` }) as { id: string };
    categoryIds.set(category.id || category.value, created.id);
  }
  for (const [index, product] of transformed.products.entries()) {
    const categoryId = categoryIds.get(product.categoryId) ?? [...categoryIds.values()][0];
    if (!categoryId) continue;
    await app.execute({
      operationId: "createProduct",
      input: {
        name: product.name || `Product ${index}`,
        categoryId,
        description: product.description,
        image: product.image || "https://example.invalid/p.png",
        variants: product.variants.length ? product.variants : [{ size: "1", unit: "Cây", price: 0, costPrice: 0 }],
      },
    }, { ...context, idempotencyKey: `mig-prd-${index}` });
  }
  for (const [index, customer] of transformed.customers.entries()) {
    await app.execute({
      operationId: "createCustomer",
      input: { name: customer.name || `Customer ${index}`, phone: customer.phone || "0000000000", address: customer.address },
    }, { ...context, idempotencyKey: `mig-cus-${index}` });
  }
  return {
    products: transformed.products.length,
    categories: transformed.categories.length,
    customers: transformed.customers.length,
    orders: transformed.orders.length,
    warnings: transformed.warnings,
  };
};
