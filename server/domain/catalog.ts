import { fail } from "./errors.ts";
import { assertVnd, type Vnd } from "./money.ts";

export interface VariantInput {
  size: string;
  unit: string;
  price: Vnd;
  costPrice: Vnd;
}

const FORBIDDEN_PUBLIC_FIELDS = [
  "costPrice",
  "cogs",
  "margin",
  "bankName",
  "accountNumber",
  "accountName",
] as const;

export const assertVariant = (variant: VariantInput): void => {
  if (!variant.size?.trim()) fail("VALIDATION_ERROR", "Variant size is required");
  if (!variant.unit?.trim()) fail("VALIDATION_ERROR", "Variant unit is required");
  assertVnd(variant.price, "price");
  assertVnd(variant.costPrice, "costPrice");
};

export const toPublicVariant = (variant: VariantInput): { size: string; unit: string; price: Vnd } => {
  assertVariant(variant);
  return { size: variant.size, unit: variant.unit, price: variant.price };
};

export const assertPublicProjection = (value: unknown): void => {
  const walk = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const next = path ? `${path}.${key}` : key;
      if ((FORBIDDEN_PUBLIC_FIELDS as readonly string[]).includes(key)) {
        fail("VALIDATION_ERROR", `Public projection leaked admin field ${key} at ${next}`);
      }
      walk(child, next);
    }
  };
  walk(value, "");
};

export const publicProductFromAdmin = (product: {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  image: string;
  isHot?: boolean;
  variants: VariantInput[];
  revision: number;
}) => {
  const projection = {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    description: product.description,
    image: product.image,
    isHot: Boolean(product.isHot),
    variants: product.variants.map(toPublicVariant),
    revision: product.revision,
  };
  assertPublicProjection(projection);
  return projection;
};
