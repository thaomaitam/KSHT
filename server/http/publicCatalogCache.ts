export const PUBLIC_CATALOG_MAX_AGE_SEC = 600;
export const PUBLIC_CATALOG_CACHE_CONTROL = `public, max-age=${PUBLIC_CATALOG_MAX_AGE_SEC}`;

type MemoryEntry = {
  status: number;
  body: string;
  headerPairs: Array<[string, string]>;
  expiresAt: number;
};

export type PublicCatalogStore = {
  memory: Map<string, MemoryEntry>;
  inflight: Map<string, Promise<Response>>;
};

export const createPublicCatalogStore = (): PublicCatalogStore => ({
  memory: new Map(),
  inflight: new Map(),
});

const isolateStore = createPublicCatalogStore();

export const resolvePublicCatalogStore = (store?: PublicCatalogStore): PublicCatalogStore => store ?? isolateStore;

export const resetPublicCatalogCacheForTests = (store: PublicCatalogStore = isolateStore): void => {
  store.memory.clear();
  store.inflight.clear();
};

export const publicCatalogCacheKey = (url: string): string => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

export const isPublicCatalogGet = (method: string, pathname: string): boolean =>
  method === "GET" && (pathname === "/api/v1/public/products" || pathname === "/api/v1/public/categories");

export const isCatalogMutationPath = (method: string, pathname: string): boolean => {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return pathname.startsWith("/api/v1/products") || pathname.startsWith("/api/v1/categories");
};

export const shouldBypassPublicCatalogCache = (request: Request): boolean => {
  const cacheControl = request.headers.get("Cache-Control") || "";
  return /\bno-cache\b/i.test(cacheControl) || /\bno-store\b/i.test(cacheControl);
};

export const readPublicCatalogMemory = (
  store: PublicCatalogStore,
  key: string,
  now = Date.now(),
): MemoryEntry | null => {
  const entry = store.memory.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) store.memory.delete(key);
    return null;
  }
  return entry;
};

export const storePublicCatalogResponse = async (
  store: PublicCatalogStore,
  key: string,
  response: Response,
  now = Date.now(),
): Promise<void> => {
  const headerPairs: Array<[string, string]> = [];
  response.headers.forEach((value, header) => headerPairs.push([header, value]));
  store.memory.set(key, {
    status: response.status,
    body: await response.clone().text(),
    headerPairs,
    expiresAt: now + PUBLIC_CATALOG_MAX_AGE_SEC * 1000,
  });
};

export const responseFromPublicCatalogMemory = (entry: MemoryEntry): Response => {
  const headers = new Headers();
  for (const [header, value] of entry.headerPairs) headers.append(header, value);
  headers.set("Cache-Control", PUBLIC_CATALOG_CACHE_CONTROL);
  return new Response(entry.body, { status: entry.status, headers });
};

export const purgePublicCatalogCache = async (store: PublicCatalogStore): Promise<void> => {
  for (const key of [...store.memory.keys()]) {
    if (key.startsWith("/api/v1/public/products") || key.startsWith("/api/v1/public/categories")) {
      store.memory.delete(key);
    }
  }
  store.inflight.clear();
};

export const runPublicCatalogSingleflight = async (
  store: PublicCatalogStore,
  key: string,
  load: () => Promise<Response>,
): Promise<Response> => {
  const pending = store.inflight.get(key);
  if (pending) return pending.then((response) => response.clone());
  const task = load().then((response) => {
    if (store.inflight.get(key) === task) store.inflight.delete(key);
    return response;
  });
  store.inflight.set(key, task);
  const response = await task;
  return response.clone();
};

export const withPublicCatalogCacheControl = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", PUBLIC_CATALOG_CACHE_CONTROL);
  return new Response(response.body, { status: response.status, headers });
};
