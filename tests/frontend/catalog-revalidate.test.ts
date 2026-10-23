import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";


const productRow = (id: string, price = 5000) => ({
  id, name: "Cọ", categoryId: "cat_1", description: "", image: "https://example.com/a.jpg",
  variants: [{ size: "1", unit: "Cây", price }], revision: 1,
});

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });

const categoriesResponse = () => json({ items: [{ id: "cat_1", label: "Cọ", value: "PAINT_BRUSH" }] });

test("storefront public reads always revalidate with the browser cache (no-cache)", async () => {
  const modes: Array<string | undefined> = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/public/products")) {
      modes.push(init?.cache);
      return json({ items: [productRow("prd_a")], page: { hasMore: false, nextCursor: null, limit: 100 } }, { "X-Catalog-Version": "v1" });
    }
    if (url.includes("/public/categories")) return categoriesResponse();
    return new Response("{}", { status: 404 });
  };
  const { storageService } = await import("../../storageService.ts");
  localStorage.clear();
  await storageService.getStorefrontProducts();
  assert.deepEqual(modes, ["no-cache"]);
});

test("revalidate fetches the network even when the local cache is fresh (SWR)", async () => {
  let price = 5000;
  let fetches = 0;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/public/products")) {
      fetches += 1;
      return json({ items: [productRow("prd_a", price)], page: { hasMore: false, nextCursor: null, limit: 100 } });
    }
    if (url.includes("/public/categories")) return categoriesResponse();
    return new Response("{}", { status: 404 });
  };
  const { storageService } = await import("../../storageService.ts");
  localStorage.clear();
  await storageService.getStorefrontProducts();
  price = 7000;
  const cached = await storageService.getStorefrontProducts();
  assert.equal(cached.source, "cache");
  assert.equal(cached.products[0].variants[0].price, 5000);
  const fresh = await storageService.getStorefrontProducts({ revalidate: true });
  assert.equal(fresh.source, "network");
  assert.equal(fresh.products[0].variants[0].price, 7000);
  assert.equal(fetches, 2);
});

test("page walk restarts when the catalog version changes between pages", async () => {
  let call = 0;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/public/categories")) return categoriesResponse();
    if (!url.includes("/public/products")) return new Response("{}", { status: 404 });
    call += 1;
    const hasCursor = url.includes("cursor=");
    // 1st walk: page1 @v1, page2 @v2 (changed mid-walk). 2nd walk: both @v2.
    const version = call === 1 ? "v1" : "v2";
    return hasCursor
      ? json({ items: [productRow(`prd_p2_${version}`)], page: { hasMore: false, nextCursor: null, limit: 1 } }, { "X-Catalog-Version": version })
      : json({ items: [productRow(`prd_p1_${version}`)], page: { hasMore: true, nextCursor: "c1", limit: 1 } }, { "X-Catalog-Version": version });
  };
  const { storageService } = await import("../../storageService.ts");
  localStorage.clear();
  const result = await storageService.getStorefrontProducts({ revalidate: true });
  assert.deepEqual(result.products.map((p) => p.id), ["prd_p1_v2", "prd_p2_v2"]);
});

test("admin catalog writes clear the storefront localStorage caches", async () => {
  const { apiService } = await import("../../apiService.ts");
  const { storageService } = await import("../../storageService.ts");
  const { settingsService } = await import("../../settingsService.ts");
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/categories") && (init?.method ?? "GET") === "GET") {
      return json({ items: [{ id: "cat_1", label: "Cọ", value: "PAINT_BRUSH", revision: 1 }], page: { hasMore: false, nextCursor: null, limit: 100 } });
    }
    if (url.includes("/products") && (init?.method ?? "GET") === "GET") {
      return json({ items: [{ ...productRow("prd_a"), variants: [{ size: "1", unit: "Cây", price: 5000, costPrice: 1 }] }], page: { hasMore: false, nextCursor: null, limit: 100 } });
    }
    return json({ id: "x", revision: 2 });
  };
  apiService.setSession("session-token-value", Date.now() + 60_000);
  try {
    const seedCaches = () => {
      localStorage.setItem("giaban_products", JSON.stringify({ v: 1, expiresAt: Date.now() + 600_000, items: [] }));
      localStorage.setItem("giaban_categories", JSON.stringify({ v: 1, expiresAt: Date.now() + 600_000, items: [] }));
    };
    const product = { ...productRow("prd_a"), category: "PAINT_BRUSH" } as any;
    for (const write of [
      () => storageService.updateProduct(product),
      () => storageService.addProduct(product),
      () => storageService.deleteProduct("prd_a", 1),
      () => settingsService.addCategory("Rulo"),
      () => settingsService.updateCategory("cat_1", "Cọ 2"),
      () => settingsService.deleteCategory("cat_1"),
    ]) {
      seedCaches();
      await write();
      assert.equal(localStorage.getItem("giaban_products"), null);
      // The admin view may re-cache its own list under the same key as a plain array;
      // storefront treats that as stale (not fresh), so the next storefront load hits the network.
      const { readStorefrontEnvelope } = await import("../../client/storefrontCache.ts");
      const categories = readStorefrontEnvelope("giaban_categories", (v: unknown): v is unknown[] => Array.isArray(v));
      assert.equal(categories?.fresh ?? false, false);
    }
  } finally {
    apiService.clearSession();
  }
});
