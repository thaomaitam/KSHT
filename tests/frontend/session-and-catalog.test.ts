import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";

test("logout clears private catalog cache and strips costPrice from public cache", async () => {
  const { apiService } = await import("../../apiService.ts");
  localStorage.setItem("giaban_products", JSON.stringify([
    { id: "prd_1", variants: [{ size: "1", unit: "Cây", price: 5000, costPrice: 2000 }] },
  ]));
  localStorage.setItem("giaban_admin_products", JSON.stringify([{ id: "prd_1", variants: [{ costPrice: 2000 }] }]));
  localStorage.setItem("giaban_orders", JSON.stringify([{ id: "ord_1" }]));
  localStorage.setItem("giaban_cart", JSON.stringify([{ productId: "prd_1", quantity: 2 }]));
  apiService.setSession("session-token-value", Date.now() + 60_000);
  apiService.clearSession();

  assert.equal(localStorage.getItem("giaban_admin_products"), null);
  assert.equal(localStorage.getItem("giaban_orders"), null);
  assert.equal(localStorage.getItem("giaban_cart"), JSON.stringify([{ productId: "prd_1", quantity: 2 }]));
  const publicCache = JSON.parse(localStorage.getItem("giaban_products") || "[]");
  assert.equal("costPrice" in (publicCache[0]?.variants?.[0] || {}), false);
  assert.equal(apiService.getSessionToken(), "");
});

test("storefront products never cache costPrice and label stale cache instead of bundled fake catalog", async () => {
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/public/products")) {
      return new Response(JSON.stringify({
        items: [{
          id: "prd_live",
          name: "Cọ live",
          categoryId: "cat_1",
          description: "",
          image: "https://example.com/a.jpg",
          variants: [{ size: "1", unit: "Cây", price: 5000 }],
          revision: 1,
        }],
        page: { hasMore: false, nextCursor: null, limit: 100 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/public/categories")) {
      return new Response(JSON.stringify({ items: [{ id: "cat_1", label: "Cọ", value: "PAINT_BRUSH" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };

  const { storageService } = await import("../../storageService.ts");
  const live = await storageService.getStorefrontProducts();
  assert.equal(live.products[0].id, "prd_live");
  assert.equal(live.truncated, false);
  assert.equal(live.source, "network");
  assert.equal("costPrice" in live.products[0].variants[0], false);

  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  const stale = await storageService.getStorefrontProducts();
  assert.equal(stale.source, "stale-cache");
  assert.equal(stale.products[0].id, "prd_live");
  assert.equal(stale.error?.retryable, true);
  assert.equal(JSON.stringify(stale.products).includes("costPrice"), false);
});

test("admin catalog maps private costPrice and walks every product page", async () => {
  const urls: string[] = [];
  const product = (id: string, costPrice: number) => ({
    id,
    name: id,
    categoryId: "cat_1",
    description: "",
    image: "",
    variants: [{ size: "1", unit: "Cây", price: 9000, costPrice }],
    revision: 3,
    archived: false,
  });
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/api/v1/products")) {
      const cursor = new URL(url, "https://giaban.example").searchParams.get("cursor");
      if (!cursor) {
        return new Response(JSON.stringify({
          items: Array.from({ length: 100 }, (_, index) => product(`prd_${index}`, 4000)),
          page: { hasMore: true, nextCursor: "c1", limit: 100 },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (cursor === "c1") {
        return new Response(JSON.stringify({
          items: Array.from({ length: 100 }, (_, index) => product(`prd_${index + 100}`, 4000)),
          page: { hasMore: true, nextCursor: "c2", limit: 100 },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        items: Array.from({ length: 20 }, (_, index) => product(`prd_${index + 200}`, 4000)),
        page: { hasMore: false, nextCursor: null, limit: 100 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/categories")) {
      return new Response(JSON.stringify({
        items: [{ id: "cat_1", label: "Cọ", value: "PAINT_BRUSH", revision: 1 }],
        page: { hasMore: false, nextCursor: null, limit: 100 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  };

  const { apiService } = await import("../../apiService.ts");
  apiService.setSession("session-token-value", Date.now() + 60_000);
  const { storageService } = await import("../../storageService.ts");
  const admin = await storageService.getAdminProducts();
  assert.equal(admin.products[0].variants[0].costPrice, 4000);
  assert.equal(localStorage.getItem('giaban_admin_products'), null);
  assert.equal(admin.products.length, 220);
  assert.equal(admin.truncated, false);
  assert.equal(urls.filter((url) => url.includes("/api/v1/products")).length, 3);
  assert.equal(urls.some((url) => url.includes("cursor=c1")), true);
  assert.equal(urls.some((url) => url.includes("cursor=c2")), true);
});

test("expired session emits one event to unmount private views", async () => {
  const { apiService, SESSION_ENDED_EVENT } = await import("../../apiService.ts");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  let ended = 0;
  events.addEventListener(SESSION_ENDED_EVENT, () => { ended += 1; });
  Object.defineProperty(globalThis, "window", { value: events, configurable: true });
  try {
    apiService.setSession("fixture-expired-token", Date.now() + 60_000);
    sessionStorage.setItem("giaban_admin_session_expiry", "1");
    assert.equal(apiService.getSessionToken(), "");
    assert.equal(apiService.getSessionToken(), "");
    assert.equal(ended, 1);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("ephemeral admin session lives only in sessionStorage", async () => {
  const { apiService } = await import("../../apiService.ts");
  const token = "ephemeral-token-value";
  apiService.setSession(token, Date.now() + 60_000);

  assert.equal(sessionStorage.getItem("giaban_admin_session_token"), token);
  assert.equal(sessionStorage.getItem("giaban_admin_auth"), "true");
  assert.equal(localStorage.getItem("giaban_admin_session_token"), null);
  assert.equal(localStorage.getItem("giaban_admin_auth"), null);

  sessionStorage.clear();
  assert.equal(apiService.getSessionToken(), "");
});

test("persisted admin session remains after sessionStorage is cleared", async () => {
  const { apiService } = await import("../../apiService.ts");
  const token = "persist-token-value";
  apiService.setSession(token, Date.now() + 60_000, { persist: true });

  assert.equal(localStorage.getItem("giaban_admin_session_token"), token);
  assert.equal(localStorage.getItem("giaban_admin_auth"), "true");
  assert.equal(sessionStorage.getItem("giaban_admin_session_token"), null);

  sessionStorage.clear();
  assert.equal(apiService.getSessionToken(), token);
});

test("ephemeral login replaces a persisted session on this browser", async () => {
  const { apiService } = await import("../../apiService.ts");
  apiService.setSession("persist-token-value", Date.now() + 60_000, { persist: true });
  apiService.setSession("ephemeral-token-value", Date.now() + 60_000);

  assert.equal(sessionStorage.getItem("giaban_admin_session_token"), "ephemeral-token-value");
  assert.equal(localStorage.getItem("giaban_admin_session_token"), null);
  assert.equal(localStorage.getItem("giaban_admin_auth"), null);
});

test("expired persisted session emits one event to unmount private views", async () => {
  const { apiService, SESSION_ENDED_EVENT } = await import("../../apiService.ts");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const events = new EventTarget();
  let ended = 0;
  events.addEventListener(SESSION_ENDED_EVENT, () => { ended += 1; });
  Object.defineProperty(globalThis, "window", { value: events, configurable: true });
  try {
    apiService.setSession("persist-expired-token", Date.now() + 60_000, { persist: true });
    localStorage.setItem("giaban_admin_session_expiry", "1");
    assert.equal(apiService.getSessionToken(), "");
    assert.equal(apiService.getSessionToken(), "");
    assert.equal(ended, 1);
    assert.equal(localStorage.getItem("giaban_admin_session_token"), null);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("clearSession removes persisted and ephemeral session keys", async () => {
  const { apiService } = await import("../../apiService.ts");
  apiService.setSession("persist-token-value", Date.now() + 60_000, { persist: true });
  sessionStorage.setItem("giaban_admin_session_token", "stale-ephemeral");
  sessionStorage.setItem("giaban_admin_auth", "true");
  apiService.clearSession();

  assert.equal(apiService.getSessionToken(), "");
  assert.equal(sessionStorage.getItem("giaban_admin_session_token"), null);
  assert.equal(localStorage.getItem("giaban_admin_session_token"), null);
  assert.equal(localStorage.getItem("giaban_admin_session_expiry"), null);
  assert.equal(localStorage.getItem("giaban_admin_auth"), null);
});
