import assert from "node:assert/strict";
import test from "node:test";

import { collectPages, completenessFromPage, parsePage, toListQuery } from "../../client/giabanPage.ts";

test("parsePage reads items and page meta without inventing a next page", () => {
  const parsed = parsePage({
    items: [{ id: "prd_1" }, { id: "prd_2" }],
    page: { hasMore: true, nextCursor: "abc", limit: 100 },
  });
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.page.hasMore, true);
  assert.equal(parsed.page.nextCursor, "abc");
  assert.equal(parsed.page.limit, 100);
});

test("completenessFromPage marks a single page truncated when hasMore", () => {
  const complete = completenessFromPage({ hasMore: false, nextCursor: null, limit: 100 });
  assert.deepEqual(complete, { truncated: false, complete: true });

  const truncated = completenessFromPage({ hasMore: true, nextCursor: "cursor-1", limit: 100 });
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.complete, false);
  assert.equal(Boolean(truncated.reason), true);
});

test("collectPages walks cursors, dedups ids, and stops on repeated cursor", async () => {
  const seenCursors: Array<string | undefined> = [];
  const collected = await collectPages<{ id: string }>(async (cursor) => {
    seenCursors.push(cursor);
    if (!cursor) {
      return { items: [{ id: "a" }, { id: "b" }], page: { hasMore: true, nextCursor: "c1", limit: 2 } };
    }
    if (cursor === "c1") {
      return { items: [{ id: "b" }, { id: "c" }], page: { hasMore: true, nextCursor: "c2", limit: 2 } };
    }
    return { items: [{ id: "d" }], page: { hasMore: false, nextCursor: null, limit: 2 } };
  });
  assert.deepEqual(collected.items.map((row) => row.id), ["a", "b", "c", "d"]);
  assert.equal(collected.truncated, false);
  assert.equal(collected.complete, true);
  assert.deepEqual(seenCursors, [undefined, "c1", "c2"]);

  const stuck = await collectPages(async () => ({
    items: [{ id: "x" }],
    page: { hasMore: true, nextCursor: "same", limit: 1 },
  }));
  assert.equal(stuck.truncated, true);
  assert.equal(stuck.complete, false);
});

test("toListQuery sends limit 100 and never a fabricated offset", () => {
  assert.equal(toListQuery({ limit: 100 }), "limit=100");
  assert.equal(toListQuery({ limit: 100, q: "co son" }), "limit=100&q=co%20son");
  assert.equal(toListQuery({ limit: 100, includeArchived: true }), "limit=100&includeArchived=true");
  const withCursor = toListQuery({ limit: 100, cursor: "abc", status: "confirmed", customerId: "cus_1" });
  assert.equal(withCursor.includes("offset="), false);
  assert.equal(withCursor.includes("page="), false);
  assert.match(withCursor, /cursor=abc/);
  assert.match(withCursor, /status=confirmed/);
  assert.match(withCursor, /customerId=cus_1/);
});
