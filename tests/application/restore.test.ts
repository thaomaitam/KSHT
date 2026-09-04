import assert from "node:assert/strict";
import test from "node:test";

import { DomainError } from "../../server/domain/errors.ts";
import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const seedCatalog = async (app: GiabanApplication) => {
  const context = ownerContext();
  const category = await app.execute({
    operationId: "createCategory",
    input: { label: "Cọ", value: "PAINT" },
  }, { ...context, idempotencyKey: "rst-cat" }) as { id: string };
  await app.execute({
    operationId: "createProduct",
    input: {
      name: "Cọ",
      categoryId: category.id,
      description: "d",
      image: "https://example.invalid/p.png",
      variants: [{ size: "1", unit: "Cây", price: 1000, costPrice: 400 }],
    },
  }, { ...context, idempotencyKey: "rst-prd" });
};

test("write fence blocks ordinary commands", async () => {
  const store = new MemoryStore();
  store.state.writeFence = true;
  const app = new GiabanApplication(store);
  await assert.rejects(
    () => app.execute({ operationId: "createCategory", input: { label: "X", value: "X" } }, ownerContext({ idempotencyKey: "fenced" })),
    (error: DomainError) => error.code === "MIGRATION_READ_ONLY",
  );
});

test("backup restore hydrates catalog onto a new generation", async () => {
  const app = new GiabanApplication(new MemoryStore());
  await seedCatalog(app);
  const context = ownerContext();
  const preview = await app.preview({ operationId: "previewBackupExport", input: {} }, context) as { confirmationToken: string };
  const backup = await app.confirm({
    operationId: "confirmBackupExport",
    input: { confirmationToken: preview.confirmationToken },
  }, context) as { id: string };
  const restorePreview = await app.preview({
    operationId: "previewRestore",
    input: { artifactId: backup.id },
  }, context) as { confirmationToken: string };
  const restored = await app.confirm({
    operationId: "confirmRestore",
    input: { confirmationToken: restorePreview.confirmationToken, artifactId: backup.id },
  }, context) as { datasetGenerationId: string; previousDatasetGenerationId: string };
  assert.notEqual(restored.datasetGenerationId, restored.previousDatasetGenerationId);
  const listed = await app.query({ operationId: "listProducts", input: {} }, context) as { items: Array<{ variants: Array<{ costPrice: number }> }> };
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].variants[0].costPrice, 400);
});
