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

const compareCreatedAtIdDesc = (
  left: { createdAt: string; id: string },
  right: { createdAt: string; id: string },
): number => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);

export const asCursor = (value: unknown): string | undefined => {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  fail("VALIDATION_ERROR", "Invalid cursor");
};

export const paginate = <T extends { createdAt: string; id: string }>(
  rows: T[],
  limitInput: number | undefined,
  cursorInput?: unknown,
): { items: T[]; page: PageMeta } => {
  const limit = normalizeLimit(limitInput);
  const cursor = decodeCursor(asCursor(cursorInput));
  const sorted = [...rows].sort(compareCreatedAtIdDesc);
  const remaining = cursor
    ? sorted.filter((row) => compareCreatedAtIdDesc(row, cursor) > 0)
    : sorted;
  const hasMore = remaining.length > limit;
  const items = hasMore ? remaining.slice(0, limit) : remaining;
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
