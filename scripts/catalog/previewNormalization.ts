import { readFile } from "node:fs/promises";

import {
  previewCatalogNormalization,
  type CatalogNormalizationManifest,
  type CatalogSnapshot,
} from "./normalizeCatalog.ts";

const [snapshotPath, manifestPath] = process.argv.slice(2);
if (!snapshotPath || !manifestPath) {
  throw new Error("Usage: previewNormalization.ts <catalog-snapshot.json> <normalization-manifest.json>");
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

const snapshot = await readJson<CatalogSnapshot>(snapshotPath);
const manifest = await readJson<CatalogNormalizationManifest>(manifestPath);
const preview = await previewCatalogNormalization(snapshot, manifest);
const targetById = new Map(preview.categories.map((category) => [category.id, category.value]));
const targetCounts: Record<string, number> = Object.fromEntries(
  manifest.targetCategories.map((category) => [category.value, 0]),
);
for (const product of preview.products) {
  if (product.archived === true) continue;
  const target = product.categoryId ? targetById.get(product.categoryId) : product.category;
  if (target && target in targetCounts) targetCounts[target] += 1;
}
const reviewCounts = preview.reviewRequired.reduce<Record<string, number>>((counts, item) => {
  counts[item.confidence] = (counts[item.confidence] ?? 0) + 1;
  return counts;
}, {});

console.log(JSON.stringify({
  mappingReady: preview.ready,
  liveApplySupported: false,
  sourceFingerprint: preview.sourceFingerprint,
  sourceSnapshotHash: preview.sourceSnapshotHash,
  applyBound: preview.applyBound,
  sourceProductCount: preview.sourceProductCount,
  changedProductCount: preview.changedProductCount,
  targetCategoryCount: manifest.targetCategories.length,
  targetCounts,
  reviewRequiredCount: preview.reviewRequired.length,
  reviewCounts,
}, null, 2));
