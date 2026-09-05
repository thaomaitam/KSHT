import { handleKshtApi, type KshtEnv } from "../../server/http/ksht.ts";
import type { BrowserApiEnvelope, BrowserApiResult } from "../../server/http/browserApi.ts";

export interface ApiEnv extends KshtEnv {
  GIABAN?: {
    handleBrowserApi(envelope: BrowserApiEnvelope): Promise<BrowserApiResult>;
  };
}

export default {
  async fetch(request: Request, env: ApiEnv): Promise<Response> {
    return handleKshtApi(request, env);
  },
};
