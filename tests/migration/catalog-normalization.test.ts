import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  catalogRenderSourceErrors,
  catalogSnapshotHash,
  catalogMappingFingerprint,
  previewCatalogNormalization,
  validateCatalogNormalization,
  type CatalogNormalizationManifest,
  type CatalogSnapshot,
} from "../../scripts/catalog/normalizeCatalog.ts";

const source = (): CatalogSnapshot => ({
  categories: [
    { id: "1", value: "ALL", label: "Tất cả" },
    { id: "2", value: "PAINT_BRUSH", label: "Cọ sơn" },
  ],
  products: [
    {
      id: "p1",
      name: "  Cọ  Sơn  Loại 1 ",
      category: "PAINT_BRUSH",
      description: "Giữ nguyên",
      image: "https://example.test/p1.jpg",
      variants: [{ size: "1\"", unit: "Lố", price: 75_000, costPrice: 50_000 }],
      customField: { retained: true },
    },
    {
      id: "p_archived",
      name: "Cọ đã lưu trữ",
      category: "PAINT_BRUSH",
      archived: true,
      variants: [{ size: "2\"", unit: "Cây", price: 1_000 }],
    },
  ],
});

const manifest = async (overrides: Partial<CatalogNormalizationManifest> = {}): Promise<CatalogNormalizationManifest> => ({
  version: 1,
  sourceFingerprint: await catalogMappingFingerprint(source()),
  sourceSnapshotHash: await catalogSnapshotHash(source()),
  sourceProductCount: 1,
  targetCategories: [
    {
      id: "cat_norm_paint_application_v1",
      value: "PAINT_COATINGS_APPLICATION",
      label: "Sơn, cọ & rulo",
    },
  ],
  mappings: [
    {
      id: "p1",
      sourceName: "  Cọ  Sơn  Loại 1 ",
      sourceCategoryKey: "PAINT_BRUSH",
      targetCategoryKey: "PAINT_COATINGS_APPLICATION",
      proposedName: "Cọ Sơn Loại 1",
      confidence: "high",
    },
  ],
  ...overrides,
});

test("catalog normalization preview changes only mapped name/category fields", async () => {
  const snapshot = source();
  const plan = await manifest();
  const preview = await previewCatalogNormalization(snapshot, plan);

  assert.equal(preview.ready, true);
  assert.deepEqual(preview.reviewRequired, []);
  assert.equal(preview.products[0].id, "p1");
  assert.equal(preview.products[0].name, "Cọ Sơn Loại 1");
  assert.equal(preview.products[0].category, "PAINT_COATINGS_APPLICATION");
  assert.equal(preview.products[0].description, "Giữ nguyên");
  assert.equal(preview.products[0].image, "https://example.test/p1.jpg");
  assert.deepEqual(preview.products[0].variants, snapshot.products[0].variants);
  assert.deepEqual(preview.products[0].customField, { retained: true });
  assert.deepEqual(preview.products[1], snapshot.products[1]);
  assert.deepEqual(preview.categories, [
    { id: "1", value: "ALL", label: "Tất cả" },
    {
      id: "cat_norm_paint_application_v1",
      value: "PAINT_COATINGS_APPLICATION",
      label: "Sơn, cọ & rulo",
    },
  ]);
  assert.equal(preview.changedProductCount, 1);
  assert.equal(preview.sourceSnapshotHash.length, 64);
});

test("catalog normalization requires review for non-high confidence mappings", async () => {
  const plan = await manifest();
  plan.mappings[0].confidence = "medium";

  const preview = await previewCatalogNormalization(source(), plan);

  assert.equal(preview.ready, false);
  assert.deepEqual(preview.reviewRequired, [{ id: "p1", confidence: "medium" }]);
});

test("explicit review makes a non-high confidence mapping ready", async () => {
  const plan = await manifest();
  plan.mappings[0].confidence = "low";
  plan.mappings[0].review = {
    reviewedBy: "owner",
    reviewedAt: "2026-09-04T00:00:00.000Z",
  };

  const preview = await previewCatalogNormalization(source(), plan);

  assert.equal(preview.ready, true);
  assert.deepEqual(preview.reviewRequired, []);
});

test("semantic name changes require an explicit attributable review", async () => {
  const plan = await manifest();
  plan.mappings[0].proposedName = "Tên Mới";

  const unreviewed = await previewCatalogNormalization(source(), plan);
  assert.equal(unreviewed.ready, false);

  plan.mappings[0].review = {
    reviewedBy: "owner",
    reviewedAt: "2026-09-04T00:00:00.000Z",
    note: "Tên đã được đối chiếu với hàng thật",
  };
  const reviewed = await previewCatalogNormalization(source(), plan);
  assert.equal(reviewed.ready, true);
});

test("catalog normalization rejects unattributable review metadata", async () => {
  const plan = await manifest();
  plan.mappings[0].confidence = "low";
  plan.mappings[0].review = { reviewedBy: " ", reviewedAt: "not-a-date" };

  const validation = await validateCatalogNormalization(source(), plan);

  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.code === "INVALID_REVIEW" && error.id === "p1"));
});

test("catalog normalization rejects incomplete, duplicate, extra, and invalid mappings", async () => {
  const plan = await manifest({
    sourceProductCount: 2,
    mappings: [
      {
        id: "p1",
        sourceName: "wrong",
        sourceCategoryKey: "WRONG",
        targetCategoryKey: "UNKNOWN",
        proposedName: " ",
        confidence: "invalid" as "high",
      },
      {
        id: "p1",
        sourceName: "duplicate",
        sourceCategoryKey: "PAINT_BRUSH",
        targetCategoryKey: "PAINT_COATINGS_APPLICATION",
        proposedName: "Duplicate",
        confidence: "high",
      },
      {
        id: "extra",
        sourceName: "Extra",
        sourceCategoryKey: "PAINT_BRUSH",
        targetCategoryKey: "PAINT_COATINGS_APPLICATION",
        proposedName: "Extra",
        confidence: "high",
      },
    ],
  });

  const result = await validateCatalogNormalization(source(), plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "SOURCE_PRODUCT_COUNT_MISMATCH"));
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_MAPPING" && error.id === "p1"));
  assert.ok(result.errors.some((error) => error.code === "EXTRA_MAPPING" && error.id === "extra"));
  assert.ok(result.errors.some((error) => error.code === "INVALID_TARGET" && error.id === "p1"));
  assert.ok(result.errors.some((error) => error.code === "BLANK_PROPOSED_NAME" && error.id === "p1"));
  assert.ok(result.errors.some((error) => error.code === "INVALID_CONFIDENCE" && error.id === "p1"));
  assert.ok(result.errors.some((error) => error.code === "SOURCE_NAME_DRIFT" && error.id === "p1"));
  assert.ok(result.errors.some((error) => error.code === "SOURCE_CATEGORY_DRIFT" && error.id === "p1"));
});

test("catalog normalization rejects missing mappings and source fingerprint drift", async () => {
  const snapshot = source();
  snapshot.products.push({ id: "p2", name: "Cọ khác", category: "PAINT_BRUSH", variants: [] });
  const plan = await manifest();

  const result = await validateCatalogNormalization(snapshot, plan);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === "SOURCE_FINGERPRINT_MISMATCH"));
  assert.ok(result.errors.some((error) => error.code === "MISSING_MAPPING" && error.id === "p2"));
});

test("price drift keeps classification valid but changes the apply-bound snapshot hash", async () => {
  const original = source();
  const changed = source();
  const variant = (changed.products[0].variants as Array<Record<string, unknown>>)[0];
  variant.price = 76_000;
  const plan = await manifest();

  const validation = await validateCatalogNormalization(changed, plan);
  const originalPreview = await previewCatalogNormalization(original, plan);
  const changedPreview = await previewCatalogNormalization(changed, plan);

  assert.equal(validation.applyBound, false);
  assert.equal(originalPreview.applyBound, true);
  assert.equal(changedPreview.applyBound, false);

  assert.equal(validation.ok, true);
  assert.notEqual(originalPreview.sourceSnapshotHash, changedPreview.sourceSnapshotHash);
});

test("render source validation rejects classification-only snapshots without prices", () => {
  const complete = source();
  const incomplete = source();
  delete (incomplete.products[0].variants as Array<Record<string, unknown>>)[0].price;

  assert.deepEqual(catalogRenderSourceErrors(complete), []);
  assert.deepEqual(catalogRenderSourceErrors(incomplete), [
    { code: "MISSING_OR_INVALID_VARIANT_PRICE", id: "p1", detail: "variant 0" },
  ]);
});

test("classification-field drift invalidates the mapping", async () => {
  const changed = source();
  changed.products[0].description = "Đã đổi công dụng";
  const plan = await manifest();

  const validation = await validateCatalogNormalization(changed, plan);

  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.code === "SOURCE_FINGERPRINT_MISMATCH"));
});

test("invalid source snapshot hash fails closed", async () => {
  const plan = await manifest();
  plan.sourceSnapshotHash = "not-a-hash";

  const result = await validateCatalogNormalization(source(), plan);

  assert.equal(result.ok, false);
  assert.equal(result.applyBound, false);
  assert.ok(result.errors.some((error) => error.code === "INVALID_SOURCE_SNAPSHOT_HASH"));
});

test("catalog mapping fingerprint is stable across source row order", async () => {
  const left = source();
  const right: CatalogSnapshot = {
    categories: [...left.categories].reverse(),
    products: [...left.products].reverse(),
  };

  assert.equal(await catalogMappingFingerprint(left), await catalogMappingFingerprint(right));
});

test("checked-in Giaban catalog manifest covers the captured public source exactly", async () => {
  const fixtureUrl = new URL("../../migrations/catalog/giaban-public-catalog-source-2026-09-04.json", import.meta.url);
  const manifestUrl = new URL("../../migrations/catalog/giaban-public-catalog-2026-09-04.json", import.meta.url);
  const snapshot = JSON.parse(await readFile(fixtureUrl, "utf8")) as CatalogSnapshot;
  const plan = JSON.parse(await readFile(manifestUrl, "utf8")) as CatalogNormalizationManifest;

  const validation = await validateCatalogNormalization(snapshot, plan);
  const preview = await previewCatalogNormalization(snapshot, plan);

  assert.equal(validation.ok, true);
  assert.equal(validation.sourceProductCount, 293);
  assert.equal(validation.mappingCount, 293);
  assert.equal(plan.targetCategories.length, 13);
  assert.equal(preview.ready, true);
  assert.deepEqual(preview.reviewRequired, []);
  assert.equal(preview.applyBound, true);
  assert.equal(validation.applyBound, true);
  assert.equal(validation.sourceSnapshotHash, plan.sourceSnapshotHash);
});
