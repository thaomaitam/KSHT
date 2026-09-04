import { canonicalJson, sha256Hex } from "../../server/safety/canonical.ts";

export type CatalogConfidence = "high" | "medium" | "low";

export interface CatalogProduct extends Record<string, unknown> {
  id: string;
  name: string;
  category?: string;
  categoryId?: string;
  archived?: boolean;
  description?: string;
  variants?: unknown[];
}

export interface CatalogCategory extends Record<string, unknown> {
  id: string;
  value: string;
  label: string;
}

export interface CatalogSnapshot {
  products: CatalogProduct[];
  categories: CatalogCategory[];
}

export interface CatalogTargetCategory {
  id: string;
  value: string;
  label: string;
}

export interface CatalogNormalizationMapping {
  id: string;
  sourceName: string;
  sourceCategoryKey: string;
  targetCategoryKey: string;
  proposedName: string;
  confidence: CatalogConfidence;
  classificationEvidence?: string[];
  classificationNote?: string;
  review?: {
    reviewedBy: string;
    reviewedAt: string;
    note?: string;
  };
}

export interface CatalogNormalizationManifest {
  version: 1;
  sourceFingerprint: string;
  sourceSnapshotHash: string;
  sourceProductCount: number;
  targetCategories: CatalogTargetCategory[];
  mappings: CatalogNormalizationMapping[];
}

export interface CatalogNormalizationError {
  code: string;
  id?: string;
  detail?: string;
}

export interface CatalogNormalizationValidation {
  ok: boolean;
  sourceFingerprint: string;
  sourceSnapshotHash: string;
  applyBound: boolean;
  sourceProductCount: number;
  mappingCount: number;
  errors: CatalogNormalizationError[];
}

export interface CatalogNormalizationPreview {
  ready: boolean;
  sourceFingerprint: string;
  sourceSnapshotHash: string;
  applyBound: boolean;
  sourceProductCount: number;
  changedProductCount: number;
  reviewRequired: Array<{ id: string; confidence: CatalogConfidence }>;
  categories: CatalogCategory[];
  products: CatalogProduct[];
}

const categoryKey = (product: CatalogProduct): string => String(product.categoryId ?? product.category ?? "");

export const normalizeCatalogNameWhitespace = (name: string): string => name.trim().replace(/\s+/g, " ");

const hasApprovedReview = (mapping: CatalogNormalizationMapping): boolean => {
  if (!mapping.review) return false;
  return Boolean(
    mapping.review.reviewedBy.trim()
    && !Number.isNaN(Date.parse(mapping.review.reviewedAt)),
  );
};

const activeProducts = (snapshot: CatalogSnapshot): CatalogProduct[] =>
  snapshot.products.filter((product) => product.archived !== true);

const sortById = <T extends { id: string }>(rows: T[]): T[] =>
  [...rows].sort((left, right) => left.id.localeCompare(right.id));

const mappingFingerprintInput = (snapshot: CatalogSnapshot): unknown => ({
  categories: sortById(snapshot.categories).map((category) => ({
    id: String(category.id ?? ""),
    value: String(category.value ?? ""),
    label: String(category.label ?? ""),
  })),
  products: sortById(activeProducts(snapshot)).map((product) => ({
    id: String(product.id ?? ""),
    name: String(product.name ?? ""),
    categoryKey: categoryKey(product),
    description: String(product.description ?? ""),
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => {
        const row = variant && typeof variant === "object" ? variant as Record<string, unknown> : {};
        return { size: String(row.size ?? ""), unit: String(row.unit ?? "") };
      })
      : [],
  })),
});

const fullSnapshotInput = (snapshot: CatalogSnapshot): unknown => ({
  categories: sortById(snapshot.categories),
  products: sortById(snapshot.products),
});

export const catalogMappingFingerprint = async (snapshot: CatalogSnapshot): Promise<string> =>
  sha256Hex(canonicalJson(mappingFingerprintInput(snapshot)));

export const catalogSnapshotHash = async (snapshot: CatalogSnapshot): Promise<string> =>
  sha256Hex(canonicalJson(fullSnapshotInput(snapshot)));

const duplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
};

export const validateCatalogNormalization = async (
  snapshot: CatalogSnapshot,
  manifest: CatalogNormalizationManifest,
): Promise<CatalogNormalizationValidation> => {
  const errors: CatalogNormalizationError[] = [];
  const products = activeProducts(snapshot);
  const sourceFingerprint = await catalogMappingFingerprint(snapshot);
  const sourceSnapshotHash = await catalogSnapshotHash(snapshot);
  const sourceIds = products.map((product) => String(product.id ?? ""));
  const mappingIds = manifest.mappings.map((mapping) => String(mapping.id ?? ""));
  const sourceIdSet = new Set(sourceIds);
  const mappingIdSet = new Set(mappingIds);
  const targetKeys = new Set(manifest.targetCategories.map((category) => category.value));

  if (manifest.version !== 1) errors.push({ code: "INVALID_MANIFEST_VERSION" });
  if (manifest.sourceProductCount !== products.length) {
    errors.push({
      code: "SOURCE_PRODUCT_COUNT_MISMATCH",
      detail: `expected ${manifest.sourceProductCount}, actual ${products.length}`,
    });
  }
  if (manifest.sourceFingerprint !== sourceFingerprint) {
    errors.push({ code: "SOURCE_FINGERPRINT_MISMATCH" });
  }
  if (!/^[0-9a-f]{64}$/.test(manifest.sourceSnapshotHash ?? "")) {
    errors.push({ code: "INVALID_SOURCE_SNAPSHOT_HASH" });
  }

  for (const id of duplicateValues(sourceIds)) errors.push({ code: "DUPLICATE_SOURCE_ID", id });
  for (const id of duplicateValues(mappingIds)) errors.push({ code: "DUPLICATE_MAPPING", id });
  for (const id of sourceIds) {
    if (!mappingIdSet.has(id)) errors.push({ code: "MISSING_MAPPING", id });
  }
  for (const id of mappingIds) {
    if (!sourceIdSet.has(id)) errors.push({ code: "EXTRA_MAPPING", id });
  }
  for (const id of duplicateValues(manifest.targetCategories.map((category) => category.id))) {
    errors.push({ code: "DUPLICATE_TARGET_CATEGORY_ID", id });
  }
  for (const value of duplicateValues(manifest.targetCategories.map((category) => category.value))) {
    errors.push({ code: "DUPLICATE_TARGET_CATEGORY_VALUE", id: value });
  }
  for (const target of manifest.targetCategories) {
    if (!target.id?.trim() || !target.value?.trim() || !target.label?.trim()) {
      errors.push({ code: "INVALID_TARGET_CATEGORY", id: target.value || target.id });
    }
  }

  const sourceById = new Map(products.map((product) => [product.id, product]));
  for (const mapping of manifest.mappings) {
    if (!targetKeys.has(mapping.targetCategoryKey)) errors.push({ code: "INVALID_TARGET", id: mapping.id });
    if (!mapping.proposedName?.trim()) errors.push({ code: "BLANK_PROPOSED_NAME", id: mapping.id });
    if (!["high", "medium", "low"].includes(mapping.confidence)) {
      errors.push({ code: "INVALID_CONFIDENCE", id: mapping.id });
    }
    if (mapping.review && !hasApprovedReview(mapping)) {
      errors.push({ code: "INVALID_REVIEW", id: mapping.id });
    }
    const product = sourceById.get(mapping.id);
    if (!product) continue;
    if (mapping.sourceName !== product.name) errors.push({ code: "SOURCE_NAME_DRIFT", id: mapping.id });
    if (mapping.sourceCategoryKey !== categoryKey(product)) {
      errors.push({ code: "SOURCE_CATEGORY_DRIFT", id: mapping.id });
    }
  }

  return {
    ok: errors.length === 0,
    sourceFingerprint,
    sourceSnapshotHash,
    applyBound: manifest.sourceSnapshotHash === sourceSnapshotHash,
    sourceProductCount: products.length,
    mappingCount: manifest.mappings.length,
    errors,
  };
};

const proposedCategories = (
  snapshot: CatalogSnapshot,
  targets: CatalogTargetCategory[],
): CatalogCategory[] => {
  const all = snapshot.categories.find((category) => category.value === "ALL");
  return [
    ...(all ? [{ ...all }] : []),
    ...targets.map((category) => ({ ...category })),
  ];
};

export const catalogRenderSourceErrors = (snapshot: CatalogSnapshot): CatalogNormalizationError[] => {
  const errors: CatalogNormalizationError[] = [];
  for (const product of snapshot.products) {
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      errors.push({ code: "MISSING_VARIANTS", id: product.id });
      continue;
    }
    product.variants.forEach((variant, index) => {
      const row = variant && typeof variant === "object" ? variant as Record<string, unknown> : {};
      if (!Number.isSafeInteger(row.price) || Number(row.price) < 0) {
        errors.push({ code: "MISSING_OR_INVALID_VARIANT_PRICE", id: product.id, detail: `variant ${index}` });
      }
    });
  }
  return errors;
};

export const previewCatalogNormalization = async (
  snapshot: CatalogSnapshot,
  manifest: CatalogNormalizationManifest,
): Promise<CatalogNormalizationPreview> => {
  const validation = await validateCatalogNormalization(snapshot, manifest);
  if (!validation.ok) {
    throw new Error(`Invalid catalog normalization manifest: ${validation.errors.map((error) => `${error.code}${error.id ? `:${error.id}` : ""}`).join(", ")}`);
  }

  const mappingById = new Map(manifest.mappings.map((mapping) => [mapping.id, mapping]));
  const targetByKey = new Map(manifest.targetCategories.map((category) => [category.value, category]));
  let changedProductCount = 0;
  const products = snapshot.products.map((product) => {
    if (product.archived === true) return { ...product };
    const mapping = mappingById.get(product.id)!;
    const target = targetByKey.get(mapping.targetCategoryKey)!;
    const next: CatalogProduct = { ...product, name: mapping.proposedName };
    if ("category" in product) next.category = target.value;
    if ("categoryId" in product) next.categoryId = target.id;
    if (product.name !== next.name || product.category !== next.category || product.categoryId !== next.categoryId) {
      changedProductCount += 1;
    }
    return next;
  });
  const reviewRequired = manifest.mappings
    .filter((mapping) => (
      mapping.confidence !== "high"
      || mapping.proposedName !== normalizeCatalogNameWhitespace(mapping.sourceName)
    ) && !hasApprovedReview(mapping))
    .map(({ id, confidence }) => ({ id, confidence }));

  return {
    ready: reviewRequired.length === 0,
    sourceFingerprint: validation.sourceFingerprint,
    sourceSnapshotHash: validation.sourceSnapshotHash,
    applyBound: validation.applyBound,
    sourceProductCount: validation.sourceProductCount,
    changedProductCount,
    reviewRequired,
    categories: proposedCategories(snapshot, manifest.targetCategories),
    products,
  };
};
