export interface CountReport {
  products: number;
  categories: number;
  customers: number;
  orders: number;
  warnings: string[];
}

export interface ReconciliationResult {
  ok: boolean;
  expected: CountReport;
  actual: CountReport;
  mismatches: string[];
}

export const reconcileCounts = (expected: CountReport, actual: CountReport): ReconciliationResult => {
  const mismatches: string[] = [];
  for (const key of ["products", "categories", "customers", "orders"] as const) {
    if (expected[key] !== actual[key]) mismatches.push(`${key}: expected ${expected[key]}, actual ${actual[key]}`);
  }
  return { ok: mismatches.length === 0, expected, actual, mismatches };
};
