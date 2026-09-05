import assert from "node:assert/strict";
import test from "node:test";

import { createSubmitLock, stepKey } from "../../utils/operationState.ts";

test("submit lock prevents double submit and keeps idempotency key on uncertain retry", () => {
  const lock = createSubmitLock();
  const first = lock.begin();
  assert.equal(typeof first, "string");
  assert.equal(lock.begin(), null);

  lock.failRetryable();
  const retry = lock.begin();
  assert.equal(retry, first);

  lock.succeed();
  const next = lock.begin();
  assert.notEqual(next, first);
  lock.succeed();
});

test("stepKey is stable for confirm and payment retries", () => {
  assert.equal(stepKey("op-1", "confirm"), "op-1:confirm");
  assert.equal(stepKey("op-1", "payment"), "op-1:payment");
});

test("terminal failure drops the previous idempotency key", () => {
  const lock = createSubmitLock();
  const first = lock.begin();
  lock.failTerminal();
  const next = lock.begin();
  assert.notEqual(next, first);
});
