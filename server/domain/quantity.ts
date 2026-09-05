import { fail } from "./errors.ts";
import { assertVnd, fromMicroVnd, toMicroVnd, toScaledInteger, type Vnd } from "./money.ts";

export const FACTOR_DECIMALS = 3;
const FACTOR_SCALE = 1000n;

export interface QuantityFactors {
  quantity: number;
  soCuon?: number | null;
  soKi?: number | null;
}

const optionalFactorScaled = (value: number | null | undefined, field: string): bigint => {
  if (value === null || value === undefined) return FACTOR_SCALE;
  const scaled = toScaledInteger(value, FACTOR_DECIMALS, field);
  return scaled > 0n ? scaled : FACTOR_SCALE;
};

export const assertFactor = (value: unknown, field: string): number => {
  const scaled = toScaledInteger(value, FACTOR_DECIMALS, field);
  return Number(scaled) / 10 ** FACTOR_DECIMALS;
};

export const effectiveQuantity = ({ quantity, soCuon, soKi }: QuantityFactors): number => {
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
    fail("VALIDATION_ERROR", "quantity must be a positive safe integer");
  }
  const rolls = optionalFactorScaled(soCuon, "soCuon");
  const kilos = optionalFactorScaled(soKi, "soKi");
  const numerator = BigInt(quantity) * rolls * kilos;
  const denom = FACTOR_SCALE * FACTOR_SCALE;
  if (numerator % denom === 0n) {
    const whole = numerator / denom;
    if (whole > BigInt(Number.MAX_SAFE_INTEGER)) {
      fail("VALIDATION_ERROR", "effective quantity overflowed");
    }
    return Number(whole);
  }
  const asNumber = Number(numerator) / Number(denom);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    fail("VALIDATION_ERROR", "effective quantity overflowed");
  }
  return asNumber;
};

export const lineAmount = (unitPrice: Vnd, factors: QuantityFactors, field = "line"): Vnd => {
  assertVnd(unitPrice, field);
  if (typeof factors.quantity !== "number" || !Number.isSafeInteger(factors.quantity) || factors.quantity < 1) {
    fail("VALIDATION_ERROR", "quantity must be a positive safe integer");
  }
  const rolls = optionalFactorScaled(factors.soCuon, "soCuon");
  const kilos = optionalFactorScaled(factors.soKi, "soKi");
  const numerator = toMicroVnd(unitPrice, field) * BigInt(factors.quantity) * rolls * kilos;
  const denom = FACTOR_SCALE * FACTOR_SCALE;
  if (numerator % denom !== 0n) {
    fail("VALIDATION_ERROR", `${field} is not representable without rounding`);
  }
  return fromMicroVnd(numerator / denom, field);
};
