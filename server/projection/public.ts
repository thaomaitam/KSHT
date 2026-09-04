import { GiabanApplication } from "../application/giaban.ts";
import { publicContext } from "../application/giaban.ts";

export interface PublicProjection {
  products: unknown[];
  categories: unknown[];
  settings: unknown;
}

export const buildPublicProjection = async (app: GiabanApplication): Promise<PublicProjection> => {
  const context = publicContext();
  const products = await app.query({ operationId: "listPublicProducts", input: {} }, context) as { items: unknown[] };
  const categories = await app.query({ operationId: "listPublicCategories", input: {} }, context) as { items: unknown[] };
  const settings = await app.query({ operationId: "getPublicSettings", input: {} }, context);
  return { products: products.items, categories: categories.items, settings };
};
