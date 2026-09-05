import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication } from "../../server/application/giaban.ts";
import { dispatchBrowserApi } from "../../server/http/browserApi.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const envFor = (app: GiabanApplication) => ({
  ADMIN_SECRET: "root",
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { return undefined; } },
  GIABAN: { handleBrowserApi: (envelope: Parameters<typeof dispatchBrowserApi>[1]) => dispatchBrowserApi(app, envelope) },
});

test("composed worker serves /api/v1 and leaves legacy /api/status intact", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const env = envFor(app);
  const login = await handleKshtApi(new Request("https://worker.example/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "pw" }),
  }), env);
  const session = await login.json() as { token: string };
  const v1 = await handleKshtApi(new Request("https://worker.example/api/v1/status", {
    headers: { authorization: `Bearer ${session.token}` },
  }), env);
  assert.equal(v1.status, 200);
  const legacy = await handleKshtApi(new Request("https://worker.example/api/status"), env);
  assert.equal(legacy.status, 200);
  assert.deepEqual(await legacy.json(), { ok: true });
});
