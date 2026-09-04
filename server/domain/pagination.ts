import { fail } from "./errors.ts";

export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 100;

export interface PageMeta {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string): string => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const normalizeLimit = (limit: number | undefined): number => {
  if (limit === undefined) return PAGE_DEFAULT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > PAGE_MAX) {
    fail("VALIDATION_ERROR", `limit must be between 1 and ${PAGE_MAX}`);
  }
  return limit;
};

export const encodeCursor = (parts: { createdAt: string; id: string }): string =>
  toBase64Url(JSON.stringify(parts));

export const decodeCursor = (cursor: string | undefined): { createdAt: string; id: string } | null => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(cursor));
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      fail("VALIDATION_ERROR", "Invalid cursor");
    }
    return parsed;
  } catch {
    fail("VALIDATION_ERROR", "Invalid cursor");
  }
};

export const paginate = <T extends { createdAt: string; id: string }>(
  rows: T[],
  limitInput: number | undefined,
): { items: T[]; page: PageMeta } => {
  const limit = normalizeLimit(limitInput);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    page: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
      limit,
    },
  };
};
