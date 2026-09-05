import { fail } from "./errors.ts";

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

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


export const businessDateOnly = (instant: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    fail("VALIDATION_ERROR", "Invalid business instant");
  }
  return `${year}-${month}-${day}`;
};

export const businessYearStart = (instant: Date = new Date()): string =>
  `${businessDateOnly(instant).slice(0, 4)}-01-01`;
