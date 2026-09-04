import { fail } from "./errors.ts";
import { BUSINESS_TIMEZONE } from "./reports.ts";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const assertDateOnly = (value: string, field: string): string => {
  if (!DATE_ONLY.test(value)) {
    fail("VALIDATION_ERROR", `${field} must be a YYYY-MM-DD business date`);
  }
  return value;
};

export const dayBoundsUtc = (dateOnly: string): { startIso: string; endIso: string } => {
  assertDateOnly(dateOnly, "date");
  const start = new Date(`${dateOnly}T00:00:00+07:00`);
  const end = new Date(`${dateOnly}T23:59:59.999+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    fail("VALIDATION_ERROR", "Invalid business date");
  }
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

export const inBusinessRange = (instantIso: string, fromDate: string, toDate: string): boolean => {
  const from = dayBoundsUtc(fromDate).startIso;
  const to = dayBoundsUtc(toDate).endIso;
  return instantIso >= from && instantIso <= to;
};

export { BUSINESS_TIMEZONE };
