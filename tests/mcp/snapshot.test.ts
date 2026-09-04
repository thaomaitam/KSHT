import assert from "node:assert/strict";
import test from "node:test";

import { GiabanApplication, ownerContext } from "../../server/application/giaban.ts";
import type { MemoryState } from "../../server/persistence/memory/store.ts";
import { SnapshotStore, type SnapshotStorage } from "../../workers/mcp/snapshotStore.ts";

class MemorySnapshot implements SnapshotStorage {
  values = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

test("SnapshotStore hydrates and persists writes across open", async () => {
  const storage = new MemorySnapshot();
  const first = await SnapshotStore.open(storage);
  const app = new GiabanApplication(first);
  const created = await app.invoke("command", "createCustomer", {
    name: "A",
    phone: "0901000001",
    address: "x",
  }, ownerContext({ channel: "mcp" })) as { id: string };
  const reopened = await SnapshotStore.open(storage);
  assert.equal(reopened.state.customers.has(created.id), true);
});

test("SnapshotStore rolls back memory on persist failure", async () => {
  const inner = new MemorySnapshot();
  const storage: SnapshotStorage = {
    get: (key) => inner.get(key),
    put: async () => {
      throw new Error("persist failed");
    },
  };
  const store = new SnapshotStore(storage);
  await assert.rejects(() => store.runInTransaction(() => {
    store.state.phone.phoneNumber = "changed";
    return "ok";
  }));
  assert.equal(store.state.phone.phoneNumber, "0901234567");
});

test("SnapshotStore seeds state once when empty", async () => {
  const storage = new MemorySnapshot();
  const first = await SnapshotStore.open(storage);
  const seeded = await storage.get<MemoryState>("state");
  assert.equal(Boolean(seeded), true);
  first.state.phone.phoneNumber = "changed";
  const second = await SnapshotStore.open(storage);
  assert.equal(second.state.phone.phoneNumber, "0901234567");
});
