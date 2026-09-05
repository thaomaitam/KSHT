import { fail } from "./errors.ts";

export const MAX_VND = Number.MAX_SAFE_INTEGER;
export const VND_DECIMALS = 6;
const VND_SCALE = 1_000_000n;
export type Vnd = number;

const scaleOf = (decimals: number): bigint => {
  let scale = 1n;
  for (let i = 0; i < decimals; i += 1) scale *= 10n;
  return scale;
};

export const toScaledInteger = (value: unknown, decimals: number, field: string): bigint => {
  const amount = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    fail("VALIDATION_ERROR", `${field} must be a non-negative finite number`);
  }
  if (Object.is(amount, -0)) return 0n;
  if (Number.isSafeInteger(amount)) {
    return BigInt(amount) * scaleOf(decimals);
  }
  const factor = 10 ** decimals;
  const scaled = amount * factor;
  if (!Number.isFinite(scaled)) {
    fail("VALIDATION_ERROR", `${field} overflowed`);
  }
  const nearest = Math.round(scaled);
  const maxError = Math.max(1e-6, Math.abs(scaled) * Number.EPSILON * 16);
  if (Math.abs(scaled - nearest) > maxError) {
    fail("VALIDATION_ERROR", `${field} cannot have more than ${decimals} decimal places`);
  }
  if (nearest < 0 || !Number.isSafeInteger(nearest)) {
    fail("VALIDATION_ERROR", `${field} overflowed`);
  }
  return BigInt(nearest);
};

export const toMicroVnd = (value: unknown, field: string): bigint => toScaledInteger(value, VND_DECIMALS, field);

export const fromMicroVnd = (micro: bigint, field: string): Vnd => {
  if (micro < 0n) fail("VALIDATION_ERROR", `${field} cannot be negative`);
  const whole = micro / VND_SCALE;
  const frac = micro % VND_SCALE;
  if (whole > BigInt(MAX_VND)) {
    fail("VALIDATION_ERROR", `${field} overflowed MAX_SAFE_INTEGER`);
  }
  if (frac === 0n) return Number(whole);
  const fracStr = frac.toString().padStart(VND_DECIMALS, "0").replace(/0+$/, "");
  const asNumber = Number(`${whole.toString()}.${fracStr}`);
  if (!Number.isFinite(asNumber) || asNumber < 0) {
    fail("VALIDATION_ERROR", `${field} overflowed`);
  }
  return asNumber;
};

export const assertVnd = (value: unknown, field: string): Vnd => fromMicroVnd(toMicroVnd(value, field), field);

export const addVnd = (...amounts: Vnd[]): Vnd => {
  let sum = 0n;
  for (const amount of amounts) {
    sum += toMicroVnd(amount, "amount");
  }
  return fromMicroVnd(sum, "amount");
};

export const subtractVnd = (left: Vnd, right: Vnd, field = "amount"): Vnd => {
  const next = toMicroVnd(left, field) - toMicroVnd(right, field);
  if (next < 0n) {
    fail("VALIDATION_ERROR", `${field} cannot be negative after subtraction`);
  }
  return fromMicroVnd(next, field);
};

export const multiplyVnd = (unit: Vnd, quantity: number, field = "amount"): Vnd => {
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < 0) {
    fail("VALIDATION_ERROR", `${field} quantity must be a non-negative finite number`);
  }
  const numerator = toMicroVnd(unit, field) * toScaledInteger(quantity, VND_DECIMALS, `${field} quantity`);
  if (numerator % VND_SCALE !== 0n) {
    fail("VALIDATION_ERROR", `${field} multiplication is not representable without rounding`);
  }
  return fromMicroVnd(numerator / VND_SCALE, field);
};
