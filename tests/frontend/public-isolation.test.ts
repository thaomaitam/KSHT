import assert from "node:assert/strict";
import test from "node:test";

import "./browserStorage.ts";

test("legacy apiService.get never persists private keys to localStorage", async () => {
  const { apiService } = await import("../../apiService.ts");
  const { PRIVATE_DATA_KEYS } = await import("../../workerContract.js");
  globalThis.fetch = async () => new Response(JSON.stringify([{ id: "secret", costPrice: 1 }]), { status: 200 });
  apiService.setSession("session-token-value", Date.now() + 60_000);
  try {
    for (const key of PRIVATE_DATA_KEYS) {
      localStorage.removeItem(`giaban_${key}`);
      await apiService.get(key);
      assert.equal(localStorage.getItem(`giaban_${key}`), null, key);
    }
  } finally {
    apiService.clearSession();
  }
});

test("admin gate is closed without a valid, unexpired session", async () => {
  const { apiService } = await import("../../apiService.ts");
  // components/LoginModal.tsx: isAdminAuthenticated = () => Boolean(apiService.getSessionToken())
  const isAdminAuthenticated = () => Boolean(apiService.getSessionToken());
  apiService.clearSession();
  assert.equal(isAdminAuthenticated(), false);
  apiService.setSession("session-token-value", Date.now() - 1);
  assert.equal(isAdminAuthenticated(), false);
  apiService.setSession("session-token-value", Date.now() + 60_000);
  assert.equal(isAdminAuthenticated(), true);
  // A 401 from any admin call clears the session (forged/revoked token -> back to login).
  globalThis.fetch = async () => new Response(JSON.stringify({ code: "UNAUTHENTICATED" }), { status: 401 });
  const { giabanClient } = await import("../../client/giabanClient.ts");
  await assert.rejects(() => giabanClient.listOrders());
  assert.equal(isAdminAuthenticated(), false);
});
