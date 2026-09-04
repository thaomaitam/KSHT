import { cloneState, createMemoryState, MemoryStore, type MemoryState } from "../../server/persistence/memory/store.ts";

export interface SnapshotStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
}

export class SnapshotStore extends MemoryStore {
  storage: SnapshotStorage;

  constructor(storage: SnapshotStorage, state?: MemoryState) {
    super(state ?? createMemoryState());
    this.storage = storage;
  }

  static async open(storage: SnapshotStorage): Promise<SnapshotStore> {
    const stored = await storage.get<MemoryState>("state");
    const store = new SnapshotStore(storage, stored);
    if (!stored) await storage.put("state", cloneState(store.state));
    return store;
  }

  async runInTransaction<T>(work: () => T | Promise<T>): Promise<T> {
    const snapshot = cloneState(this.state);
    try {
      const result = await work();
      await this.storage.put("state", cloneState(this.state));
      return result;
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }
}
