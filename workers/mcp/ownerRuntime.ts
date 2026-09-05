import { GiabanApplication } from "../../server/application/giaban.ts";
import { dispatchBrowserApi, type BrowserApiEnvelope, type BrowserApiResult } from "../../server/http/browserApi.ts";
import { handleMcpRequest, type McpEnv } from "./server.ts";
import { LiveKvStore, type CoordinatorStorage, type LiveKvNamespace, type LiveKvStoreOptions } from "./liveKvStore.ts";

export interface OwnerRuntime {
  app: GiabanApplication;
  store: LiveKvStore;
  handleBrowserApi(envelope: BrowserApiEnvelope): Promise<BrowserApiResult>;
  handleMcp(request: Request): Promise<Response>;
}

export const createOwnerRuntime = async (
  storage: CoordinatorStorage,
  kv: LiveKvNamespace,
  env: McpEnv = {},
  options?: LiveKvStoreOptions,
): Promise<OwnerRuntime> => {
  const store = await LiveKvStore.open(storage, kv, options);
  const app = new GiabanApplication(store);
  let requestTail = Promise.resolve();
  const runExclusive = async <T>(work: () => Promise<T>): Promise<T> => {
    const previous = requestTail;
    let release = () => {};
    requestTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  };
  return {
    app,
    store,
    handleBrowserApi: (envelope) => runExclusive(async () => {
      await store.flushPending();
      await store.refreshConsistency();
      return dispatchBrowserApi(app, envelope);
    }),
    handleMcp: (request) => runExclusive(async () => {
      await store.flushPending();
      await store.refreshConsistency();
      return handleMcpRequest(request, app, null, env);
    }),
  };
};
