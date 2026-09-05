export const PAGE_MAX = 100;
export const PAGE_WALK_MAX = 50;

export interface PageMeta {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

export interface ParsedPage<T = any> {
  items: T[];
  page: PageMeta;
}

export interface Completeness {
  truncated: boolean;
  complete: boolean;
  reason?: string;
}

export type ListQuery = {
  limit?: number;
  cursor?: string;
  q?: string;
  categoryId?: string;
  includeArchived?: boolean;
  orderId?: string;
  status?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
};

export const parsePage = <T = any>(body: any): ParsedPage<T> => {
  const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
  const raw = body?.page && typeof body.page === "object" ? body.page : {};
  const limit = Number.isSafeInteger(raw.limit) ? raw.limit : PAGE_MAX;
  const hasMore = Boolean(raw.hasMore);
  const nextCursor = typeof raw.nextCursor === "string" && raw.nextCursor ? raw.nextCursor : null;
  return {
    items,
    page: { hasMore, nextCursor, limit },
  };
};

export const completenessFromPage = (page: PageMeta): Completeness => {
  if (!page.hasMore) return { truncated: false, complete: true };
  return {
    truncated: true,
    complete: false,
    reason: "Còn trang tiếp theo.",
  };
};

const itemIdentity = (item: unknown, fallback: string): string => {
  if (item && typeof item === "object") {
    const record = item as { id?: unknown; orderId?: unknown };
    if (typeof record.id === "string" && record.id) return record.id;
    if (typeof record.orderId === "string" && record.orderId) return record.orderId;
  }
  return fallback;
};

export const collectPages = async <T = any>(
  fetchPage: (cursor: string | undefined) => Promise<unknown>,
): Promise<{ items: T[]; truncated: boolean; complete: boolean; reason?: string; page: PageMeta }> => {
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let previousCursor: string | undefined;
  let lastPage: PageMeta = { hasMore: false, nextCursor: null, limit: PAGE_MAX };

  for (let pageNo = 0; pageNo < PAGE_WALK_MAX; pageNo += 1) {
    const parsed = parsePage<T>(await fetchPage(cursor));
    lastPage = parsed.page;
    parsed.items.forEach((item, index) => {
      const id = itemIdentity(item, `idx:${items.length}:${index}`);
      if (seen.has(id)) return;
      seen.add(id);
      items.push(item);
    });
    if (!parsed.page.hasMore) {
      return { items, truncated: false, complete: true, page: parsed.page };
    }
    const next = parsed.page.nextCursor;
    if (!next || next === cursor || next === previousCursor) {
      return {
        items,
        truncated: true,
        complete: false,
        reason: "Máy chủ báo còn dữ liệu nhưng cursor không tiến.",
        page: parsed.page,
      };
    }
    previousCursor = cursor;
    cursor = next;
  }

  return {
    items,
    truncated: true,
    complete: false,
    reason: "Đã dừng sau số trang tối đa để tránh vòng lặp.",
    page: lastPage,
  };
};

export const toListQuery = (params: ListQuery = {}): string => {
  const parts = [`limit=${params.limit ?? PAGE_MAX}`];
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.categoryId) parts.push(`categoryId=${encodeURIComponent(params.categoryId)}`);
  if (params.includeArchived) parts.push("includeArchived=true");
  if (params.orderId) parts.push(`orderId=${encodeURIComponent(params.orderId)}`);
  if (params.status) parts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.customerId) parts.push(`customerId=${encodeURIComponent(params.customerId)}`);
  if (params.fromDate) parts.push(`fromDate=${encodeURIComponent(params.fromDate)}`);
  if (params.toDate) parts.push(`toDate=${encodeURIComponent(params.toDate)}`);
  if (params.cursor) parts.push(`cursor=${encodeURIComponent(params.cursor)}`);
  return parts.join("&");
};
