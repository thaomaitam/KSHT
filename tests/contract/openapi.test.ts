import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";

import { ERROR_CODES } from "../../server/domain/errors.ts";
import { OPERATIONS } from "../../server/application/registry.ts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const spec = parse(fs.readFileSync(path.join(root, "contracts/giaban-api.openapi.yaml"), "utf8")) as Record<string, any>;

const walk = (node: unknown, visit: (value: unknown) => void): void => {
  visit(node);
  if (Array.isArray(node)) node.forEach((item) => walk(item, visit));
  else if (node && typeof node === "object") Object.values(node).forEach((value) => walk(value, visit));
};

test("OpenAPI document is 3.1 and forbids remote refs", () => {
  assert.equal(spec.openapi, "3.1.0");
  walk(spec, (value) => {
    if (value && typeof value === "object" && "$ref" in (value as object)) {
      const ref = String((value as { $ref: string }).$ref);
      assert.equal(ref.startsWith("#/"), true, ref);
      assert.equal(/^https?:/i.test(ref), false, ref);
    }
  });
});

test("every registry operation exists in the contract with matching MCP tool", () => {
  const operationIds = new Set<string>();
  const tools = new Set<string>();
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem as object)) {
      if (!operation || typeof operation !== "object" || !("operationId" in operation)) continue;
      const op = operation as { operationId: string; "x-giaban-mcp"?: { tool: string } };
      operationIds.add(op.operationId);
      if (op["x-giaban-mcp"]?.tool) tools.add(op["x-giaban-mcp"].tool);
    }
  }
  for (const operation of OPERATIONS) {
    assert.equal(operationIds.has(operation.operationId), true, operation.operationId);
    if (operation.tool) assert.equal(tools.has(operation.tool), true, operation.tool);
  }
});

test("public product schema allowlists fields and excludes cost", () => {
  const schema = spec.components.schemas.PublicProduct;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    Object.keys(schema.properties).sort(),
    ["categoryId", "description", "id", "image", "isHot", "name", "revision", "variants"].sort(),
  );
  const variant = spec.components.schemas.PublicProductVariant;
  assert.equal(variant.additionalProperties, false);
  assert.equal("costPrice" in variant.properties, false);
  const example = JSON.parse(fs.readFileSync(path.join(root, "contracts/examples/public-product.json"), "utf8"));
  assert.equal("costPrice" in example, false);
  assert.equal("costPrice" in example.variants[0], false);
});

test("error codes in the contract match the domain", () => {
  assert.deepEqual(spec.components.schemas.ErrorCode.enum, [...ERROR_CODES]);
});
