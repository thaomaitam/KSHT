import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  catalogRenderSourceErrors,
  previewCatalogNormalization,
  type CatalogNormalizationManifest,
  type CatalogSnapshot,
} from "./normalizeCatalog.ts";

const [snapshotPath, manifestPath, outputPath] = process.argv.slice(2);
if (!snapshotPath || !manifestPath || !outputPath) {
  throw new Error("Usage: renderNormalizationArtifact.ts <catalog-snapshot.json> <normalization-manifest.json> <new-output.json>");
}
if ([snapshotPath, manifestPath].map((path) => resolve(path)).includes(resolve(outputPath))) {
  throw new Error("Output path must not overwrite the source snapshot or manifest");
}

const readJson = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(path, "utf8")) as T;

const snapshot = await readJson<CatalogSnapshot>(snapshotPath);
const manifest = await readJson<CatalogNormalizationManifest>(manifestPath);
const sourceErrors = catalogRenderSourceErrors(snapshot);
if (sourceErrors.length > 0) {
  const examples = sourceErrors
    .slice(0, 10)
    .map((error) => `${error.code}:${error.id ?? "unknown"}`)
    .join(", ");
  throw new Error(`Catalog render source is incomplete (${sourceErrors.length} errors): ${examples}${sourceErrors.length > 10 ? ", …" : ""}`);
}
const preview = await previewCatalogNormalization(snapshot, manifest);
if (!preview.ready) {
  throw new Error(`Catalog normalization still requires ${preview.reviewRequired.length} reviewed mappings`);
}
if (!preview.applyBound) {
  throw new Error("Catalog render source snapshot hash does not match the recorded apply-bound hash");
}

const artifact = {
  version: 1,
  liveApplySupported: false,
  sourceFingerprint: preview.sourceFingerprint,
  sourceSnapshotHash: preview.sourceSnapshotHash,
  sourceProductCount: preview.sourceProductCount,
  changedProductCount: preview.changedProductCount,
  snapshot: {
    ...snapshot,
    categories: preview.categories,
    products: preview.products,
  },
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
console.log(JSON.stringify({
  outputPath,
  sourceSnapshotHash: preview.sourceSnapshotHash,
  productCount: preview.sourceProductCount,
  categoryCount: preview.categories.length,
}));
