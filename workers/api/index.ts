import { GiabanApplication } from "../../server/application/giaban.ts";
import { MemoryStore } from "../../server/persistence/memory/store.ts";
import { contextFromApiRequest, handleKshtApi, type KshtEnv } from "../../server/http/ksht.ts";
import { GiabanDomain as DomainRpc } from "../../server/rpc/domain.ts";
import type { InvokeEnvelope } from "../../server/rpc/invoke.ts";

const apps = new WeakMap<object, GiabanApplication>();

const getApp = (env: object): GiabanApplication => {
  const existing = apps.get(env);
  if (existing) return existing;
  const created = new GiabanApplication(new MemoryStore());
  apps.set(env, created);
  return created;
};

export class GiabanDomain {
  env: KshtEnv & { ASSERTION_SECRET?: string };

  constructor(_ctx: unknown, env: KshtEnv & { ASSERTION_SECRET?: string }) {
    this.env = env;
  }

  async invoke(envelope: InvokeEnvelope) {
    const secret = this.env.ASSERTION_SECRET;
    if (!secret) throw new Error("ASSERTION_SECRET missing");
    return new DomainRpc(getApp(this.env), secret).invoke(envelope);
  }
}

export default {
  async fetch(request: Request, env: KshtEnv): Promise<Response> {
    return handleKshtApi(request, env, getApp(env), contextFromApiRequest(request));
  },
};
