import { fail } from "./errors.ts";
import { assertVnd, multiplyVnd, type Vnd } from "./money.ts";

export interface QuantityFactors {
  quantity: number;
  soCuon?: number | null;
  soKi?: number | null;
}

const optionalPositiveFactor = (value: number | null | undefined, field: string): number => {
  if (value === null || value === undefined) return 1;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("VALIDATION_ERROR", `${field} must be a non-negative safe integer`);
  }
  return value > 0 ? value : 1;
};

export const effectiveQuantity = ({ quantity, soCuon, soKi }: QuantityFactors): number => {
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
    fail("VALIDATION_ERROR", "quantity must be a positive safe integer");
  }
  const rolls = optionalPositiveFactor(soCuon, "soCuon");
  const kilos = optionalPositiveFactor(soKi, "soKi");
  if (quantity > Math.floor(Number.MAX_SAFE_INTEGER / rolls)) {
    fail("VALIDATION_ERROR", "effective quantity overflowed");
  }
  const withRolls = quantity * rolls;
  if (withRolls > Math.floor(Number.MAX_SAFE_INTEGER / kilos)) {
    fail("VALIDATION_ERROR", "effective quantity overflowed");
  }
  return withRolls * kilos;
};

export const lineAmount = (unitPrice: Vnd, factors: QuantityFactors, field = "line"): Vnd => {
  assertVnd(unitPrice, field);
  return multiplyVnd(unitPrice, effectiveQuantity(factors), field);
};
