// Isolate memory entries are keyed by catalog version, so a stale entry can never be
// served after a mutation in another isolate; the TTL only bounds memory use.
export const PUBLIC_CATALOG_MAX_AGE_SEC = 600;
// Browsers/proxies may store the response but must revalidate (ETag -> 304) every time.
export const PUBLIC_CATALOG_CACHE_CONTROL = "public, no-cache";
export const CATALOG_VERSION_HEADER = "X-Catalog-Version";

export const catalogEtag = (version: string): string => `"cv-${version}"`;

export const etagMatches = (ifNoneMatch: string | null, etag: string): boolean => {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").map((value) => value.trim().replace(/^W\//, "")).some((value) => value === etag || value === "*");
};

export const versionedCatalogCacheKey = (version: string, key: string): string => `${version}|${key}`;

export const withCatalogHeaders = (response: Response, version: string | null): Response => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", PUBLIC_CATALOG_CACHE_CONTROL);
  if (version) {
    headers.set("etag", catalogEtag(version));
    headers.set(CATALOG_VERSION_HEADER, version);
  } else {
    headers.delete("etag");
    headers.delete(CATALOG_VERSION_HEADER);
  }
  return new Response(response.body, { status: response.status, headers });
};

export const catalogNotModified = (version: string): Response => new Response(null, {
  status: 304,
  headers: {
    "cache-control": PUBLIC_CATALOG_CACHE_CONTROL,
    etag: catalogEtag(version),
    [CATALOG_VERSION_HEADER]: version,
    "x-content-type-options": "nosniff",
  },
});

/** Drop entries that belong to an older catalog version. */
export const prunePublicCatalogVersions = (store: PublicCatalogStore, version: string): void => {
  const prefix = `${version}|`;
  for (const key of [...store.memory.keys()]) if (!key.startsWith(prefix)) store.memory.delete(key);
};

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
  return new Response(entry.body, { status: entry.status, headers });
};

export const purgePublicCatalogCache = async (store: PublicCatalogStore): Promise<void> => {
  for (const key of [...store.memory.keys()]) {
    const path = key.includes("|") ? key.slice(key.indexOf("|") + 1) : key;
    if (path.startsWith("/api/v1/public/products") || path.startsWith("/api/v1/public/categories")) {
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
