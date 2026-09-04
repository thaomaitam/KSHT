import { fail } from "./errors.ts";

export const MAX_VND = Number.MAX_SAFE_INTEGER;
export type Vnd = number;

export const assertVnd = (value: unknown, field: string): Vnd => {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  fail("VALIDATION_ERROR", `${field} must be a non-negative safe integer VND amount`);
};

export const addVnd = (...amounts: Vnd[]): Vnd => {
  let sum = 0;
  for (const amount of amounts) {
    assertVnd(amount, "amount");
    const next = sum + amount;
    if (!Number.isSafeInteger(next)) {
      fail("VALIDATION_ERROR", "VND addition overflowed MAX_SAFE_INTEGER");
    }
    sum = next;
  }
  return sum;
};

export const subtractVnd = (left: Vnd, right: Vnd, field = "amount"): Vnd => {
  assertVnd(left, field);
  assertVnd(right, field);
  if (right > left) {
    fail("VALIDATION_ERROR", `${field} cannot be negative after subtraction`);
  }
  return left - right;
};

export const multiplyVnd = (unit: Vnd, quantity: number, field = "amount"): Vnd => {
  assertVnd(unit, field);
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 0) {
    fail("VALIDATION_ERROR", `${field} quantity must be a non-negative safe integer`);
  }
  if (quantity !== 0 && unit > Math.floor(MAX_VND / quantity)) {
    fail("VALIDATION_ERROR", `${field} multiplication overflowed MAX_SAFE_INTEGER`);
  }
  return unit * quantity;
};
