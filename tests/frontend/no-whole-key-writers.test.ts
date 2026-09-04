import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "../..");
const TARGETS = [
  "apiService.ts",
  "businessService.ts",
  "settingsService.ts",
  "storageService.ts",
  "client",
  "components",
  "hooks",
];

const FORBIDDEN = [
  /\bsaveCloud\s*\(/,
  /\bapiService\.save\s*\(/,
  /\bsaveProducts\s*\(/,
  /\bsaveOrders\s*\(/,
  /\bsaveCustomers\s*\(/,
  /\bsaveCostPrices\s*\(/,
  /\bsaveTransactions\s*\(/,
  /\bsaveCategories\s*\(/,
  /method:\s*['"]POST['"][\s\S]{0,400}\/api\/data\//,
  /\/api\/data\/\$\{key\}[\s\S]{0,200}method:\s*['"]POST['"]/,
];

const collect = (path: string, files: string[]) => {
  const full = join(ROOT, path);
  const stats = statSync(full);
  if (stats.isFile()) {
    if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full);
    return;
  }
  for (const entry of readdirSync(full)) {
    collect(join(path, entry), files);
  }
};

test("frontend has no revisionless whole-key writers", () => {
  const files: string[] = [];
  for (const target of TARGETS) collect(target, files);
  assert.ok(files.length > 8, "expected frontend sources");
  const hits: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN) {
      if (pattern.test(source)) hits.push(`${file.replace(ROOT + "/", "")} matches ${pattern}`);
    }
  }
  assert.deepEqual(hits, []);
});
