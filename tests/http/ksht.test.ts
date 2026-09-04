import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import { handleKshtApi } from "../../server/http/ksht.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";

const env = {
  ADMIN_SECRET: "root",
  SESSION_SIGNING_SECRET: "sign",
  TK_ADMIN: "admin",
  MK_ADMIN: "pw",
  ALLOWED_ORIGINS: "",
  LOGIN_RATE_LIMITER: { async limit() { return { success: true }; } },
  DB: { async get() { return null; }, async put() { return undefined; } },
};

test("composed worker serves /api/v1 and leaves legacy /api/status intact", async () => {
  const app = new GiabanApplication(new MemoryStore());
  const v1 = await handleKshtApi(new Request("https://worker.example/api/v1/status"), env, app, ownerContext());
  assert.equal(v1.status, 200);
  const legacy = await handleKshtApi(new Request("https://worker.example/api/status"), env, app, ownerContext());
  assert.equal(legacy.status, 200);
  assert.deepEqual(await legacy.json(), { ok: true });
});
