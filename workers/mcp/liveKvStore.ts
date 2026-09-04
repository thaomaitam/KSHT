import {
  cloneState,
  createMemoryState,
  MemoryStore,
  type CashRecord,
  type CustomerRecord,
  type MemoryState,
  type OrderRecord,
  type PaymentRecord,
  type ProductRecord,
  type TemplateRecord,
} from "../../server/persistence/memory/store.ts";
import { computeOrderTotals, netCollected, normalizePhone, outstandingForOrder } from "../../server/domain/index.ts";
import { fail } from "../../server/domain/errors.ts";
import { canonicalJson, sha256Hex } from "../../server/safety/canonical.ts";
import type { SnapshotStorage } from "./snapshotStore.ts";

export const LIVE_STATE_KEY = "__giaban_mcp_state_v1";
const PENDING_KEY = "live-kv-pending-v1";
const COMMITTED_KEY = "live-kv-committed-v1";
const MAP_TAG = "__giaban_map_v1__";
const LEGACY_KEYS = [
  "products",
  "categories",
  "settings",
  "orders",
  "customers",
  "costPrices",
  "transactions",
  "bankInfo",
  "taxRate",
  "shopTemplates",
] as const;

type LegacyKey = (typeof LEGACY_KEYS)[number];
type LegacyDocuments = Record<LegacyKey, unknown>;

export interface LiveKvNamespace {
  get<T = unknown>(key: string, type?: "json"): Promise<T | string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface CoordinatorStorage extends SnapshotStorage {
  delete(key: string): Promise<unknown>;
}

export interface LiveKvStoreOptions {
  minimumWriteIntervalMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
}

interface StoredEnvelope {
  version: 1;
  state: unknown;
  legacy: LegacyDocuments;
  migrationBlockers?: string[];
  blockedKeys?: LegacyKey[];
  committedAt?: string;
}

interface PendingPublish {
  version: 1;
  writes: Array<{ key: string; value: string }>;
  legacy?: LegacyDocuments;
  committed?: StoredEnvelope;
}

class PublishError extends Error {
  journaled: boolean;

  constructor(cause: unknown, journaled: boolean) {
    super(cause instanceof Error ? cause.message : "Live KV publish failed");
    this.name = "PublishError";
    this.journaled = journaled;
    this.cause = cause;
  }
}

const STORAGE_CHUNK_SIZE = 900_000;

interface ChunkedHead {
  chunked: true;
  count: number;
}

const putChunked = async (coordinator: CoordinatorStorage, key: string, value: unknown): Promise<void> => {
  const encoded = JSON.stringify(value);
  const count = Math.max(1, Math.ceil(encoded.length / STORAGE_CHUNK_SIZE));
  await coordinator.put(key, { chunked: true, count } satisfies ChunkedHead);
  for (let index = 0; index < count; index += 1) {
    const start = index * STORAGE_CHUNK_SIZE;
    await coordinator.put(`${key}#${index}`, encoded.slice(start, start + STORAGE_CHUNK_SIZE));
  }
};

const getChunked = async <T>(coordinator: CoordinatorStorage, key: string): Promise<T | undefined> => {
  const head = await coordinator.get<ChunkedHead | T>(key);
  if (head && typeof head === "object" && !Array.isArray(head) && (head as ChunkedHead).chunked === true) {
    const count = (head as ChunkedHead).count;
    if (!Number.isInteger(count) || count < 1) return undefined;
    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await coordinator.get<string>(`${key}#${index}`);
      if (typeof part !== "string") return undefined;
      parts.push(part);
    }
    return JSON.parse(parts.join("")) as T;
  }
  return head as T | undefined;
};

const deleteChunked = async (coordinator: CoordinatorStorage, key: string): Promise<void> => {
  const head = await coordinator.get<ChunkedHead>(key);
  if (head && typeof head === "object" && head.chunked === true && Number.isInteger(head.count)) {
    for (let index = 0; index < head.count; index += 1) await coordinator.delete(`${key}#${index}`);
  }
  await coordinator.delete(key);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];

const safeInteger = (value: unknown, fallback = 0): number => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
};

const positiveInteger = (value: unknown, fallback = 1): number => {
  const number = safeInteger(value, fallback);
  return number > 0 ? number : fallback;
};

const optionalFactor = (value: unknown): number | null => {
  const number = safeInteger(value, 0);
  return number > 0 ? number : null;
};

const revision = (value: unknown): number => Math.max(1, safeInteger(value, 1));
const stringOr = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const timestamp = (value: unknown, fallback: string): string => typeof value === "string" && value ? value : fallback;

const encodeState = (state: MemoryState): unknown => JSON.parse(JSON.stringify(state, (_key, value) =>
  value instanceof Map ? { [MAP_TAG]: [...value.entries()] } : value,
));

const decodeState = (value: unknown): MemoryState => JSON.parse(JSON.stringify(value), (_key, child) => {
  if (child && typeof child === "object" && !Array.isArray(child)) {
    const record = child as Record<string, unknown>;
    if (Object.keys(record).length === 1 && Array.isArray(record[MAP_TAG])) return new Map(record[MAP_TAG] as Array<[string, unknown]>);
  }
  return child;
}) as MemoryState;

const emptyLegacy = (): LegacyDocuments => ({
  products: null,
  categories: null,
  settings: null,
  orders: null,
  customers: null,
  costPrices: null,
  transactions: null,
  bankInfo: null,
  taxRate: null,
  shopTemplates: null,
});

const costIndex = (value: unknown) => {
  const byProduct = new Map<string, { price: number; variants: Record<string, unknown>[] }>();
  if (Array.isArray(value)) {
    for (const row of asArray(value)) {
      const productId = stringOr(row.productId ?? row.id);
      if (!productId) continue;
      byProduct.set(productId, {
        price: safeInteger(row.price ?? row.costPrice),
        variants: asArray(row.variants),
      });
    }
  } else {
    for (const [productId, price] of Object.entries(asRecord(value))) {
      byProduct.set(productId, { price: safeInteger(price), variants: [] });
    }
  }
  return byProduct;
};

const lineTotal = (item: OrderRecord["items"][number]): number => {
  const quantity = item.quantity * (item.soCuon && item.soCuon > 0 ? item.soCuon : 1) * (item.soKi && item.soKi > 0 ? item.soKi : 1);
  const total = quantity * item.unitPrice;
  return Number.isSafeInteger(total) && total >= 0 ? total : 0;
};

const legacyStatus = (value: unknown): OrderRecord["status"] => {
  if (value === "shipping" || value === "completed" || value === "cancelled" || value === "draft" || value === "discarded") return value;
  return "confirmed";
};

export interface MigrationDiagnostics {
  sourceHash: string;
  customerLinks: {
    explicitValidId: number;
    uniquePhoneAndMatchingName: number;
    uniquePhoneNameDisagreement: number;
    duplicatePhoneAmbiguity: number;
    noCandidate: number;
    missingPhone: number;
  };
  money: {
    debtMatchingComputedTotal: number;
    totalDiffersByLegacyDebt: number;
    unexplainedTotalMismatch: number;
  };
}

type CustomerLinkReviewClass = Exclude<keyof MigrationDiagnostics["customerLinks"], "explicitValidId">;

const emptyMigrationDiagnostics = (sourceHash = ""): MigrationDiagnostics => ({
  sourceHash,
  customerLinks: {
    explicitValidId: 0,
    uniquePhoneAndMatchingName: 0,
    uniquePhoneNameDisagreement: 0,
    duplicatePhoneAmbiguity: 0,
    noCandidate: 0,
    missingPhone: 0,
  },
  money: {
    debtMatchingComputedTotal: 0,
    totalDiffersByLegacyDebt: 0,
    unexplainedTotalMismatch: 0,
  },
});

const normalizePersonName = (name: string): string => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

const classifyCustomerLink = (
  row: Record<string, unknown>,
  customersByPhone: Map<string, Array<{ id: string; name: string }>>,
): CustomerLinkReviewClass => {
  const phone = normalizePhone(stringOr(row.phone));
  if (!phone) return "missingPhone";
  const matches = customersByPhone.get(phone) ?? [];
  if (matches.length === 0) return "noCandidate";
  if (matches.length > 1) return "duplicatePhoneAmbiguity";
  const orderName = normalizePersonName(stringOr(row.customerName ?? row.name));
  const customerName = normalizePersonName(matches[0]?.name ?? "");
  if (orderName && customerName && orderName === customerName) return "uniquePhoneAndMatchingName";
  return "uniquePhoneNameDisagreement";
};

const classifyMoney = (legacyDebt: number, legacyTotal: number, computedTotal: number): keyof MigrationDiagnostics["money"] => {
  if (legacyDebt > 0 && legacyTotal === computedTotal && legacyDebt <= computedTotal) return "debtMatchingComputedTotal";
  if (legacyDebt > 0 && legacyTotal === computedTotal + legacyDebt) return "totalDiffersByLegacyDebt";
  return "unexplainedTotalMismatch";
};

const foldPersonName = (name: string): string =>
  normalizePersonName(name).normalize("NFD").replace(/\p{M}/gu, "");

export interface QuarantineReview {
  customerLinks: {
    uniquePhoneNameDisagreement: {
      count: number;
      emptyOrderName: number;
      diacriticOrWhitespaceOnly: number;
      other: number;
    };
    duplicatePhoneAmbiguity: {
      count: number;
      groups: number;
      orderNameMatchesExactlyOneCustomer: number;
      orderNameMatchesNone: number;
    };
    noCandidate: {
      count: number;
      hasName: number;
      missingName: number;
    };
    missingPhone: {
      count: number;
      hasName: number;
      missingName: number;
      hasNonEmptyCustomerId: number;
    };
  };
  money: {
    unexplainedTotalMismatch: {
      count: number;
      debtZero: number;
      debtPositive: number;
      totalEqualsComputed: number;
      totalGreaterThanComputed: number;
      totalLessThanComputed: number;
      alsoCustomerLinkQuarantine: number;
    };
  };
}

const emptyQuarantineReview = (): QuarantineReview => ({
  customerLinks: {
    uniquePhoneNameDisagreement: { count: 0, emptyOrderName: 0, diacriticOrWhitespaceOnly: 0, other: 0 },
    duplicatePhoneAmbiguity: { count: 0, groups: 0, orderNameMatchesExactlyOneCustomer: 0, orderNameMatchesNone: 0 },
    noCandidate: { count: 0, hasName: 0, missingName: 0 },
    missingPhone: { count: 0, hasName: 0, missingName: 0, hasNonEmptyCustomerId: 0 },
  },
  money: {
    unexplainedTotalMismatch: {
      count: 0,
      debtZero: 0,
      debtPositive: 0,
      totalEqualsComputed: 0,
      totalGreaterThanComputed: 0,
      totalLessThanComputed: 0,
      alsoCustomerLinkQuarantine: 0,
    },
  },
});

export const buildQuarantineReview = (legacy: { orders?: unknown; customers?: unknown }): QuarantineReview => {
  const review = emptyQuarantineReview();
  const customerIds = new Set<string>();
  const customersByPhone = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of asArray(legacy.customers)) {
    const id = stringOr(row.id ?? row.customerId);
    if (!id || customerIds.has(id)) continue;
    customerIds.add(id);
    const phone = normalizePhone(stringOr(row.phone));
    if (!phone) continue;
    const group = customersByPhone.get(phone) ?? [];
    group.push({ id, name: stringOr(row.name) });
    customersByPhone.set(phone, group);
  }

  const duplicatePhones = new Set<string>();
  for (const row of asArray(legacy.orders)) {
    const orderId = stringOr(row.id);
    if (!orderId) continue;
    const customerId = stringOr(row.customerId);
    const linked = Boolean(customerId && customerIds.has(customerId));
    let customerLinkQuarantine = false;
    if (!linked) {
      customerLinkQuarantine = true;
      const linkClass = classifyCustomerLink(row, customersByPhone);
      const orderName = normalizePersonName(stringOr(row.customerName ?? row.name));
      if (linkClass === "uniquePhoneNameDisagreement") {
        const bucket = review.customerLinks.uniquePhoneNameDisagreement;
        bucket.count += 1;
        if (!orderName) bucket.emptyOrderName += 1;
        else {
          const phone = normalizePhone(stringOr(row.phone));
          const customerName = normalizePersonName(customersByPhone.get(phone)?.[0]?.name ?? "");
          if (customerName && foldPersonName(orderName) === foldPersonName(customerName)) bucket.diacriticOrWhitespaceOnly += 1;
          else bucket.other += 1;
        }
      } else if (linkClass === "duplicatePhoneAmbiguity") {
        const bucket = review.customerLinks.duplicatePhoneAmbiguity;
        bucket.count += 1;
        const phone = normalizePhone(stringOr(row.phone));
        if (phone) duplicatePhones.add(phone);
        const matches = (customersByPhone.get(phone) ?? []).filter((customer) => normalizePersonName(customer.name) === orderName);
        if (orderName && matches.length === 1) bucket.orderNameMatchesExactlyOneCustomer += 1;
        else if (matches.length === 0) bucket.orderNameMatchesNone += 1;
      } else if (linkClass === "noCandidate") {
        const bucket = review.customerLinks.noCandidate;
        bucket.count += 1;
        if (orderName) bucket.hasName += 1;
        else bucket.missingName += 1;
      } else if (linkClass === "missingPhone") {
        const bucket = review.customerLinks.missingPhone;
        bucket.count += 1;
        if (orderName) bucket.hasName += 1;
        else bucket.missingName += 1;
        if (customerId) bucket.hasNonEmptyCustomerId += 1;
      }
    }

    const computedTotal = computedOrderTotal(row);
    if (computedTotal === null) continue;
    const recordedPaid = typeof row.paidAmount === "number" && Number.isSafeInteger(row.paidAmount) && row.paidAmount >= 0
      ? row.paidAmount
      : null;
    const legacyDebt = safeInteger(row.debt);
    const legacyTotal = row.total === undefined ? computedTotal : safeInteger(row.total);
    if (recordedPaid !== null || (legacyDebt <= 0 && legacyTotal === computedTotal)) continue;
    if (classifyMoney(legacyDebt, legacyTotal, computedTotal) !== "unexplainedTotalMismatch") continue;
    const bucket = review.money.unexplainedTotalMismatch;
    bucket.count += 1;
    if (legacyDebt > 0) bucket.debtPositive += 1;
    else bucket.debtZero += 1;
    if (legacyTotal === computedTotal) bucket.totalEqualsComputed += 1;
    else if (legacyTotal > computedTotal) bucket.totalGreaterThanComputed += 1;
    else bucket.totalLessThanComputed += 1;
    if (customerLinkQuarantine) bucket.alsoCustomerLinkQuarantine += 1;
  }
  review.customerLinks.duplicatePhoneAmbiguity.groups = duplicatePhones.size;
  return review;
};


const hashLegacySource = async (kv: LiveKvNamespace): Promise<string> => {
  const parts = await Promise.all(LEGACY_KEYS.map(async (key) => {
    const value = await kv.get(key);
    return `${key}\n${typeof value === "string" ? value : ""}`;
  }));
  return sha256Hex(parts.join("\n"));
};

const RECONCILE_POLICY_VERSION = "r2-2026-09-04";

export interface LiveReconciliationCounts {
  preserveExplicitValidId: number;
  autoLinkUniquePhoneAndMatchingName: number;
  quarantineCustomerLinks: number;
  deriveHistoricalPayment: number;
  stripPriorDebtCarryover: number;
  quarantineMoney: number;
}

interface LiveReconciliationPlan {
  policyVersion: string;
  sourceHash: string;
  planHash: string;
  autoLinks: Array<{ orderId: string; customerId: string }>;
  historicalPayments: Array<{ orderId: string; paidAmount: number }>;
  stripPriorDebt: Array<{ orderId: string; total: number }>;
  counts: LiveReconciliationCounts;
  affectedDocuments: Array<"orders" | "customers">;
  blockers: string[];
}

const computedOrderTotal = (row: Record<string, unknown>): number | null => {
  const items = asArray(row.items).map((item, itemIndex) => ({
    id: stringOr(item.id, `line_${itemIndex}`),
    productId: stringOr(item.productId) || null,
    name: stringOr(item.name),
    unit: stringOr(item.unit),
    quantity: positiveInteger(item.quantity),
    soCuon: optionalFactor(item.soCuon),
    soKi: optionalFactor(item.soKi),
    unitPrice: safeInteger(item.unitPrice ?? item.price),
    costPrice: safeInteger(item.costPrice),
    isManual: Boolean(item.isManual),
  }));
  if (items.length === 0) return null;
  const lineSubtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = Math.min(safeInteger(row.discount), lineSubtotal);
  return computeOrderTotals(items, discount, safeInteger(row.shippingFee)).total;
};

const buildLiveReconciliationPlan = async (legacy: LegacyDocuments, sourceHash: string): Promise<LiveReconciliationPlan> => {
  const customerIds = new Set<string>();
  const customersByPhone = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of asArray(legacy.customers)) {
    const id = stringOr(row.id ?? row.customerId);
    if (!id || customerIds.has(id)) continue;
    customerIds.add(id);
    const phone = normalizePhone(stringOr(row.phone));
    if (!phone) continue;
    const group = customersByPhone.get(phone) ?? [];
    group.push({ id, name: stringOr(row.name) });
    customersByPhone.set(phone, group);
  }

  const autoLinks: Array<{ orderId: string; customerId: string }> = [];
  const historicalPayments: Array<{ orderId: string; paidAmount: number }> = [];
  const stripPriorDebt: Array<{ orderId: string; total: number }> = [];
  let preserveExplicitValidId = 0;
  let quarantineCustomerLinks = 0;
  let quarantineMoney = 0;

  for (const row of asArray(legacy.orders)) {
    const orderId = stringOr(row.id);
    if (!orderId) continue;
    const computedTotal = computedOrderTotal(row);
    if (computedTotal === null) continue;
    const customerId = stringOr(row.customerId);
    if (customerId && customerIds.has(customerId)) {
      preserveExplicitValidId += 1;
    } else if (classifyCustomerLink(row, customersByPhone) === "uniquePhoneAndMatchingName") {
      const match = customersByPhone.get(normalizePhone(stringOr(row.phone)))?.[0];
      if (match) autoLinks.push({ orderId, customerId: match.id });
    } else {
      quarantineCustomerLinks += 1;
    }
    const legacyDebt = safeInteger(row.debt);
    const legacyTotal = row.total === undefined ? computedTotal : safeInteger(row.total);
    if (legacyDebt > 0 || legacyTotal !== computedTotal) {
      const moneyClass = classifyMoney(legacyDebt, legacyTotal, computedTotal);
      if (moneyClass === "debtMatchingComputedTotal") historicalPayments.push({ orderId, paidAmount: computedTotal - legacyDebt });
      else if (moneyClass === "totalDiffersByLegacyDebt") stripPriorDebt.push({ orderId, total: computedTotal });
      else quarantineMoney += 1;
    }
  }

  autoLinks.sort((left, right) => left.orderId.localeCompare(right.orderId));
  historicalPayments.sort((left, right) => left.orderId.localeCompare(right.orderId));
  stripPriorDebt.sort((left, right) => left.orderId.localeCompare(right.orderId));
  const planHash = await sha256Hex(canonicalJson({
    policyVersion: RECONCILE_POLICY_VERSION,
    autoLinks,
    historicalPayments,
    stripPriorDebt,
  }));
  const hasWrites = autoLinks.length + historicalPayments.length + stripPriorDebt.length > 0;
  const blockers: string[] = [];
  if (quarantineCustomerLinks > 0) blockers.push("customer_link_quarantine");
  if (quarantineMoney > 0) blockers.push("money_quarantine");
  return {
    policyVersion: RECONCILE_POLICY_VERSION,
    sourceHash,
    planHash,
    autoLinks,
    historicalPayments,
    stripPriorDebt,
    counts: {
      preserveExplicitValidId,
      autoLinkUniquePhoneAndMatchingName: autoLinks.length,
      quarantineCustomerLinks,
      deriveHistoricalPayment: historicalPayments.length,
      stripPriorDebtCarryover: stripPriorDebt.length,
      quarantineMoney,
    },
    affectedDocuments: hasWrites ? ["orders"] : [],
    blockers,
  };
};

const applyReconciliationPatches = (legacy: LegacyDocuments, plan: LiveReconciliationPlan): LegacyDocuments => {
  const autoLinkByOrder = new Map(plan.autoLinks.map((item) => [item.orderId, item.customerId]));
  const paidByOrder = new Map(plan.historicalPayments.map((item) => [item.orderId, item.paidAmount]));
  const totalByOrder = new Map(plan.stripPriorDebt.map((item) => [item.orderId, item.total]));
  return {
    ...legacy,
    orders: asArray(legacy.orders).map((row) => {
      const orderId = stringOr(row.id);
      const customerId = autoLinkByOrder.get(orderId);
      const paidAmount = paidByOrder.get(orderId);
      const total = totalByOrder.get(orderId);
      if (customerId === undefined && paidAmount === undefined && total === undefined) return row;
      const next: Record<string, unknown> = { ...row };
      if (customerId !== undefined) next.customerId = customerId;
      if (paidAmount !== undefined) {
        next.debt = 0;
        next.paidAmount = paidAmount;
        next.paymentStatus = paidAmount > 0 && paidAmount >= safeInteger(next.total, paidAmount) ? "paid" : "unpaid";
      }
      if (total !== undefined) {
        next.total = total;
        next.debt = 0;
      }
      return next;
    }),
  };
};

const publicReconciliationView = (plan: LiveReconciliationPlan, extra: Record<string, unknown> = {}) => ({
  planHash: plan.planHash,
  sourceHash: plan.sourceHash,
  affectedDocuments: plan.affectedDocuments,
  counts: plan.counts,
  blockers: plan.blockers,
  ...extra,
});

const hydrateLegacyState = (legacy: LegacyDocuments, now: string): {
  state: MemoryState;
  migrationBlockers: string[];
  blockedKeys: Set<LegacyKey>;
  diagnostics: MigrationDiagnostics;
} => {
  const state = createMemoryState(now);
  const migrationBlockers: string[] = [];
  const blockedKeys = new Set<LegacyKey>();
  const diagnostics = emptyMigrationDiagnostics();
  const addBlocker = (code: string, ...keys: LegacyKey[]) => {
    migrationBlockers.push(code);
    keys.forEach((key) => blockedKeys.add(key));
  };
  for (const key of ["products", "categories", "orders", "customers", "transactions", "shopTemplates"] as const) {
    const document = legacy[key];
    if (document !== null && document !== undefined && !Array.isArray(document)) addBlocker(`${key}:document_must_be_array`, key);
    if (Array.isArray(document) && document.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
      addBlocker(`${key}:malformed_row`, key);
    }
  }
  if (Array.isArray(legacy.costPrices)) {
    const costIds = new Set<string>();
    for (const row of asArray(legacy.costPrices)) {
      const productId = stringOr(row.productId ?? row.id);
      if (!productId || costIds.has(productId)) addBlocker("costPrices:missing_or_duplicate_product_id", "costPrices", "products");
      if (productId) costIds.add(productId);
    }
  }
  state.generationId = "gen_live_v1";
  const categories = asArray(legacy.categories);
  const categoryByValue = new Map<string, string>();
  const categoryIds = new Set<string>();
  const categoryValues = new Set<string>();
  for (const row of categories) {
    const value = stringOr(row.value ?? row.id);
    const id = stringOr(row.id, value);
    if (!value || !id || categoryIds.has(id) || categoryValues.has(value)) {
      addBlocker("categories:missing_or_duplicate_id_or_value", "categories", "products");
      continue;
    }
    categoryIds.add(id);
    categoryValues.add(value);
    if (value === "ALL") continue;
    categoryByValue.set(value, id);
    state.categories.set(id, {
      id,
      label: stringOr(row.label ?? row.name, value),
      value,
      archived: false,
      revision: revision(row.revision),
      datasetGenerationId: state.generationId,
      createdAt: timestamp(row.createdAt, now),
      updatedAt: timestamp(row.updatedAt, now),
    });
  }

  const costs = costIndex(legacy.costPrices);
  const productIds = new Set<string>();
  for (const row of asArray(legacy.products)) {
    const id = stringOr(row.id);
    if (!id || productIds.has(id)) {
      addBlocker("products:missing_or_duplicate_id", "products", "costPrices");
      continue;
    }
    productIds.add(id);
    const categoryValue = stringOr(row.category ?? row.categoryId);
    const productCosts = costs.get(id);
    const variants = asArray(row.variants).map((variant) => {
      const matchingCost = productCosts?.variants.find((cost) =>
        stringOr(cost.size) === stringOr(variant.size) && stringOr(cost.unit) === stringOr(variant.unit),
      );
      return {
        size: stringOr(variant.size),
        unit: stringOr(variant.unit),
        price: safeInteger(variant.price),
        costPrice: safeInteger(variant.costPrice ?? matchingCost?.costPrice ?? matchingCost?.price ?? productCosts?.price),
      };
    });
    if (variants.length === 0) addBlocker(`product:${id}:missing_variants`, "products", "costPrices");
    state.products.set(id, {
      id,
      name: stringOr(row.name),
      categoryId: categoryByValue.get(categoryValue) ?? categoryValue,
      description: stringOr(row.description),
      image: stringOr(row.image),
      isHot: Boolean(row.isHot),
      variants,
      archived: false,
      revision: revision(row.revision),
      datasetGenerationId: state.generationId,
      createdAt: timestamp(row.createdAt, now),
      updatedAt: timestamp(row.updatedAt, now),
    });
  }

  const customerIds = new Set<string>();
  for (const row of asArray(legacy.customers)) {
    const id = stringOr(row.id ?? row.customerId);
    if (!id || customerIds.has(id)) {
      addBlocker("customers:missing_or_duplicate_id", "customers", "orders");
      continue;
    }
    customerIds.add(id);
    state.customers.set(id, {
      id,
      name: stringOr(row.name),
      phone: stringOr(row.phone),
      address: stringOr(row.address),
      archived: false,
      revision: revision(row.revision),
      mergedIntoId: null,
      datasetGenerationId: state.generationId,
      createdAt: timestamp(row.createdAt ?? row.lastOrderDate, now),
      updatedAt: timestamp(row.updatedAt ?? row.lastOrderDate, now),
    });
  }

  const customersByPhone = new Map<string, Array<{ id: string; name: string }>>();
  for (const customer of state.customers.values()) {
    const phone = normalizePhone(customer.phone);
    if (!phone) continue;
    const group = customersByPhone.get(phone) ?? [];
    group.push({ id: customer.id, name: customer.name });
    customersByPhone.set(phone, group);
  }

  const orderIds = new Set<string>();
  asArray(legacy.orders).forEach((row, orderIndex) => {
    const id = stringOr(row.id, `legacy_order_${orderIndex}`);
    if (!stringOr(row.id) || orderIds.has(id)) addBlocker(`order:${id}:missing_or_duplicate_id`, "orders", "customers");
    if (orderIds.has(id)) return;
    orderIds.add(id);
    let customerId = stringOr(row.customerId);
    if (!customerId || !state.customers.has(customerId)) {
      migrationBlockers.push(`order:${id}:customer_id_requires_review`);
      diagnostics.customerLinks[classifyCustomerLink(row, customersByPhone)] += 1;
      customerId = `legacy_customer_${id}`;
      if (!state.customers.has(customerId)) {
        state.customers.set(customerId, {
          id: customerId,
          name: stringOr(row.customerName ?? row.name, "Khách legacy"),
          phone: stringOr(row.phone),
          address: stringOr(row.address),
          archived: false,
          revision: 1,
          mergedIntoId: null,
          datasetGenerationId: state.generationId,
          createdAt: timestamp(row.createdAt, now),
          updatedAt: timestamp(row.createdAt, now),
        });
      }
    } else {
      diagnostics.customerLinks.explicitValidId += 1;
    }
    const itemIds = new Set<string>();
    const items = asArray(row.items).map((item, itemIndex) => {
      const itemId = stringOr(item.id, `${id}_line_${itemIndex}`);
      if (!stringOr(item.id) || itemIds.has(itemId)) addBlocker(`order:${id}:missing_or_duplicate_line_id`, "orders", "customers");
      itemIds.add(itemId);
      return {
        id: itemId,
        productId: stringOr(item.productId) || null,
        name: stringOr(item.name),
        unit: stringOr(item.unit),
        quantity: positiveInteger(item.quantity),
        soCuon: optionalFactor(item.soCuon),
        soKi: optionalFactor(item.soKi),
        unitPrice: safeInteger(item.unitPrice ?? item.price),
        costPrice: safeInteger(item.costPrice),
        isManual: Boolean(item.isManual),
      };
    });
    if (items.length === 0) {
      addBlocker(`order:${id}:missing_items`, "orders", "customers");
      return;
    }
    const lineSubtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
    const requestedDiscount = safeInteger(row.discount);
    const status = legacyStatus(row.status);
    const createdAt = timestamp(row.createdAt, now);
    const order: OrderRecord = {
      id,
      customerId,
      contact: {
        name: stringOr(row.customerName ?? row.name, state.customers.get(customerId)?.name),
        phone: stringOr(row.phone, state.customers.get(customerId)?.phone),
        address: stringOr(row.address, state.customers.get(customerId)?.address),
      },
      items,
      status,
      discount: Math.min(requestedDiscount, lineSubtotal),
      shippingFee: safeInteger(row.shippingFee),
      note: stringOr(row.note),
      shopTemplateId: stringOr(row.shopTemplateId) || null,
      sellerSnapshot: null,
      paymentMethod: row.paymentMethod === "banking" ? "banking" : "cod",
      revision: revision(row.revision),
      discarded: status === "discarded",
      cancelReason: status === "cancelled" ? stringOr(row.cancelReason, "Imported legacy cancellation") : null,
      datasetGenerationId: state.generationId,
      createdAt,
      updatedAt: timestamp(row.updatedAt, createdAt),
    };
    state.orders.set(id, order);
    const totals = computeOrderTotals(items, order.discount, order.shippingFee);
    const legacyDebt = safeInteger(row.debt);
    const legacyTotal = row.total === undefined ? totals.total : safeInteger(row.total);
    const recordedPaid = typeof row.paidAmount === "number" && Number.isSafeInteger(row.paidAmount) && row.paidAmount >= 0
      ? row.paidAmount
      : null;
    if (recordedPaid === null && (legacyDebt > 0 || legacyTotal !== totals.total)) {
      migrationBlockers.push(`order:${id}:legacy_total_or_debt_requires_review`);
      diagnostics.money[classifyMoney(legacyDebt, legacyTotal, totals.total)] += 1;
    }
    const treatedPaid = status !== "cancelled" && status !== "discarded" && row.paymentStatus !== "unpaid" && legacyDebt === 0 && recordedPaid === null;
    if (status !== "cancelled" && status !== "discarded" && recordedPaid !== null && recordedPaid > 0) {
      const paymentId = `legacy_payment_${id}`;
      state.payments.set(paymentId, {
        id: paymentId,
        orderId: id,
        amount: Math.min(recordedPaid, totals.total),
        reversedAmount: 0,
        refundedAmount: 0,
        method: stringOr(row.paymentMethod, "cash"),
        note: "Imported from legacy paid amount",
        datasetGenerationId: state.generationId,
        createdAt,
      });
    } else if (treatedPaid && totals.total > 0) {
      const paymentId = `legacy_payment_${id}`;
      state.payments.set(paymentId, {
        id: paymentId,
        orderId: id,
        amount: totals.total,
        reversedAmount: 0,
        refundedAmount: 0,
        method: stringOr(row.paymentMethod, "cash"),
        note: "Imported from legacy payment status",
        datasetGenerationId: state.generationId,
        createdAt,
      });
    }
  });

  const transactionIds = new Set<string>();
  for (const row of asArray(legacy.transactions)) {
    const id = stringOr(row.id);
    if (!id || transactionIds.has(id)) {
      addBlocker("transactions:missing_or_duplicate_id", "transactions");
      continue;
    }
    transactionIds.add(id);
    state.cash.set(id, {
      id,
      type: row.type === "expense" ? "expense" : "income",
      amount: safeInteger(row.amount),
      reversedAmount: safeInteger(row.reversedAmount),
      description: stringOr(row.description),
      category: stringOr(row.category),
      date: stringOr(row.date, now.slice(0, 10)),
      datasetGenerationId: state.generationId,
      createdAt: timestamp(row.createdAt ?? row.date, now),
    });
  }

  const templateIds = new Set<string>();
  for (const row of asArray(legacy.shopTemplates)) {
    const id = stringOr(row.id);
    if (!id || templateIds.has(id)) {
      addBlocker("shopTemplates:missing_or_duplicate_id", "shopTemplates");
      continue;
    }
    templateIds.add(id);
    state.templates.set(id, {
      id,
      name: stringOr(row.name),
      address: stringOr(row.address),
      phone: stringOr(row.phone),
      isDefault: Boolean(row.isDefault),
      archived: false,
      revision: revision(row.revision),
      datasetGenerationId: state.generationId,
      createdAt: timestamp(row.createdAt, now),
      updatedAt: timestamp(row.updatedAt, now),
    });
  }

  const settings = asRecord(legacy.settings);
  state.phone = { phoneNumber: stringOr(settings.phoneNumber, state.phone.phoneNumber), revision: revision(settings.revision) };
  state.shop = {
    name: stringOr(settings.shopName ?? settings.name, state.shop.name),
    address: stringOr(settings.address, state.shop.address),
    revision: revision(settings.shopRevision ?? settings.revision),
  };
  const bank = asRecord(legacy.bankInfo);
  state.bank = {
    bankName: stringOr(bank.bankName),
    accountNumber: stringOr(bank.accountNumber),
    accountName: stringOr(bank.accountName),
    qrCodeUrl: stringOr(bank.qrCodeUrl),
    revision: revision(bank.revision),
  };
  const tax = asRecord(legacy.taxRate);
  state.tax = { rate: safeInteger(tax.rate ?? legacy.taxRate), revision: revision(tax.revision) };
  return { state, migrationBlockers, blockedKeys, diagnostics };
};

const active = <T extends { datasetGenerationId: string }>(values: Iterable<T>, state: MemoryState): T[] =>
  [...values].filter((row) => row.datasetGenerationId === state.generationId);


const orderTotals = (state: MemoryState, order: OrderRecord) => {
  const totals = computeOrderTotals(order.items, order.discount, order.shippingFee);
  const payments = active(state.payments.values(), state).filter((payment) => payment.orderId === order.id);
  const collected = netCollected(payments);
  return { ...totals, netCollected: collected, outstanding: outstandingForOrder(totals.total, collected, order.status) };
};

const mergeById = (value: unknown): Map<string, Record<string, unknown>> =>
  new Map(
    asArray(value)
      .map((row): [string, Record<string, unknown>] => [stringOr(row.id ?? row.productId), row])
      .filter(([id]) => Boolean(id)),
  );

const HISTORICAL_ORDER_REVIEW_SUFFIXES = [
  ":customer_id_requires_review",
  ":legacy_total_or_debt_requires_review",
] as const;

const frozenOrderIdsFromBlockers = (blockers: readonly string[]): Set<string> => {
  const frozen = new Set<string>();
  for (const code of blockers) {
    if (!code.startsWith("order:")) continue;
    const suffix = HISTORICAL_ORDER_REVIEW_SUFFIXES.find((item) => code.endsWith(item));
    if (!suffix) continue;
    frozen.add(code.slice("order:".length, code.length - suffix.length));
  }
  return frozen;
};

const isSyntheticLegacyCustomer = (id: string): boolean => id.startsWith("legacy_customer_");

const projectLegacy = (state: MemoryState, base: LegacyDocuments, frozenOrderIds: Set<string> = new Set()): LegacyDocuments => {
  const categoryRows = active(state.categories.values(), state).filter((row) => !row.archived);
  const categoryValues = new Map(categoryRows.map((row) => [row.id, row.value]));
  const allCategory = asArray(base.categories).find((row) => row.value === "ALL") ?? { id: "ALL", label: "Tất cả", value: "ALL" };
  const categories = [{
    id: stringOr(allCategory.id, "ALL"),
    label: stringOr(allCategory.label, "Tất cả"),
    value: "ALL",
  }, ...categoryRows.map((row) => ({
    id: row.id,
    label: row.label,
    value: row.value,
    revision: row.revision,
  }))];

  const products = active(state.products.values(), state).filter((row) => !row.archived).map((row) => {
    return {
      id: row.id,
      name: row.name,
      category: categoryValues.get(row.categoryId) ?? row.categoryId,
      description: row.description,
      image: row.image,
      isHot: row.isHot,
      variants: row.variants.map((variant) => ({
        size: variant.size,
        unit: variant.unit,
        price: variant.price,
      })),
      revision: row.revision,
    };
  });

  const oldCosts = new Map(asArray(base.costPrices).map((row) => [stringOr(row.productId ?? row.id), row]));
  const costPrices = active(state.products.values(), state).filter((row) => !row.archived).map((row) => ({
    ...oldCosts.get(row.id),
    productId: row.id,
    price: row.variants[0]?.costPrice ?? 0,
    variants: row.variants.map((variant) => ({ size: variant.size, unit: variant.unit, costPrice: variant.costPrice })),
  }));

  const liveOrders = active(state.orders.values(), state).filter((order) => !order.discarded);
  const oldOrders = mergeById(base.orders);
  const projectedOrders = liveOrders.filter((order) => !frozenOrderIds.has(order.id)).map((order) => {
    const totals = orderTotals(state, order);
    const old = oldOrders.get(order.id) ?? {};
    const oldItems = asArray(old.items);
    return {
      ...old,
      id: order.id,
      customerId: order.customerId,
      customerName: order.contact.name,
      phone: order.contact.phone,
      address: order.contact.address,
      items: order.items.map((item) => ({
        ...(oldItems.find((candidate) => stringOr(candidate.id) === item.id) ?? {}),
        ...item,
        soCuon: item.soCuon ?? undefined,
        soKi: item.soKi ?? undefined,
        total: lineTotal(item),
      })),
      total: totals.total,
      status: order.status === "shipping" || order.status === "completed" || order.status === "cancelled" ? order.status : "pending",
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      note: order.note,
      shippingFee: order.shippingFee,
      discount: order.discount,
      debt: totals.outstanding,
      paymentStatus: totals.outstanding > 0 ? "unpaid" : "paid",
      shopTemplateId: order.shopTemplateId ?? undefined,
      revision: order.revision,
    };
  });
  const preservedHistoricalOrders = [...frozenOrderIds]
    .map((id) => oldOrders.get(id))
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const orders = [...preservedHistoricalOrders, ...projectedOrders];

  const stats = new Map<string, { totalSpent: number; lastOrderDate: string; orderCount: number; debt: number }>();
  for (const order of liveOrders.filter((row) => row.status !== "cancelled" && row.status !== "discarded" && !frozenOrderIds.has(row.id))) {
    const totals = orderTotals(state, order);
    const current = stats.get(order.customerId) ?? { totalSpent: 0, lastOrderDate: "", orderCount: 0, debt: 0 };
    current.totalSpent += totals.total;
    current.orderCount += 1;
    current.debt += totals.outstanding;
    if (order.createdAt > current.lastOrderDate) current.lastOrderDate = order.createdAt;
    stats.set(order.customerId, current);
  }
  for (const id of frozenOrderIds) {
    const old = oldOrders.get(id);
    if (!old) continue;
    const customerId = stringOr(old.customerId);
    if (!customerId || isSyntheticLegacyCustomer(customerId)) continue;
    const status = stringOr(old.status);
    if (status === "cancelled" || status === "discarded") continue;
    const current = stats.get(customerId) ?? { totalSpent: 0, lastOrderDate: "", orderCount: 0, debt: 0 };
    current.totalSpent += safeInteger(old.total);
    current.orderCount += 1;
    current.debt += safeInteger(old.debt);
    const createdAt = stringOr(old.createdAt);
    if (createdAt > current.lastOrderDate) current.lastOrderDate = createdAt;
    stats.set(customerId, current);
  }
  const oldCustomers = mergeById(base.customers);
  const customers = active(state.customers.values(), state).filter((row) => !row.archived && !row.mergedIntoId && !isSyntheticLegacyCustomer(row.id)).map((row) => ({
    ...oldCustomers.get(row.id),
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    totalSpent: stats.get(row.id)?.totalSpent ?? 0,
    lastOrderDate: stats.get(row.id)?.lastOrderDate ?? "",
    orderCount: stats.get(row.id)?.orderCount ?? 0,
    debt: stats.get(row.id)?.debt ?? 0,
    revision: row.revision,
  }));

  const oldTransactions = mergeById(base.transactions);
  const transactions = active(state.cash.values(), state)
    .map((row) => ({ row, remaining: Math.max(0, row.amount - row.reversedAmount) }))
    .filter(({ remaining }) => remaining > 0)
    .map(({ row, remaining }) => ({
      ...oldTransactions.get(row.id),
      id: row.id,
      type: row.type,
      amount: remaining,
      description: row.description,
      date: row.date,
      category: row.category,
    }));

  const oldTemplates = mergeById(base.shopTemplates);
  const shopTemplates = active(state.templates.values(), state).filter((row) => !row.archived).map((row) => ({
    ...oldTemplates.get(row.id),
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    isDefault: row.isDefault,
    revision: row.revision,
  }));

  return {
    products,
    categories,
    settings: { phoneNumber: state.phone.phoneNumber, revision: state.phone.revision },
    orders,
    customers,
    costPrices,
    transactions,
    bankInfo: { ...state.bank },
    taxRate: { rate: state.tax.rate, revision: state.tax.revision },
    shopTemplates,
  };
};

export interface MigrationBlockerSummaryItem {
  type: string;
  count: number;
}

const STATIC_MIGRATION_BLOCKER_TYPES = new Set([
  "products:document_must_be_array",
  "products:malformed_row",
  "categories:document_must_be_array",
  "categories:malformed_row",
  "orders:document_must_be_array",
  "orders:malformed_row",
  "customers:document_must_be_array",
  "customers:malformed_row",
  "transactions:document_must_be_array",
  "transactions:malformed_row",
  "shopTemplates:document_must_be_array",
  "shopTemplates:malformed_row",
  "costPrices:missing_or_duplicate_product_id",
  "categories:missing_or_duplicate_id_or_value",
  "products:missing_or_duplicate_id",
  "customers:missing_or_duplicate_id",
  "transactions:missing_or_duplicate_id",
  "shopTemplates:missing_or_duplicate_id",
]);

const RECORD_SCOPED_MIGRATION_BLOCKERS = [
  { prefix: "product:", suffix: ":missing_variants", type: "product:missing_variants" },
  { prefix: "order:", suffix: ":missing_or_duplicate_id", type: "order:missing_or_duplicate_id" },
  { prefix: "order:", suffix: ":customer_id_requires_review", type: "order:customer_id_requires_review" },
  { prefix: "order:", suffix: ":missing_or_duplicate_line_id", type: "order:missing_or_duplicate_line_id" },
  { prefix: "order:", suffix: ":missing_items", type: "order:missing_items" },
  { prefix: "order:", suffix: ":legacy_total_or_debt_requires_review", type: "order:legacy_total_or_debt_requires_review" },
] as const;

const safeMigrationBlockerType = (blocker: string): string => {
  if (STATIC_MIGRATION_BLOCKER_TYPES.has(blocker)) return blocker;
  for (const candidate of RECORD_SCOPED_MIGRATION_BLOCKERS) {
    if (blocker.startsWith(candidate.prefix) && blocker.endsWith(candidate.suffix)) return candidate.type;
  }
  if (blocker.startsWith("external_kv_change:")) return "external_kv_change";
  if (blocker.startsWith("external_or_stale_kv:")) return "external_or_stale_kv";
  return "other";
};

const summarizeMigrationBlockers = (blockers: string[]): MigrationBlockerSummaryItem[] => {
  const counts = new Map<string, number>();
  for (const blocker of blockers) {
    const type = safeMigrationBlockerType(blocker);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ type, count }));
};

const sameDocument = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export class LiveKvStore extends MemoryStore {
  coordinator: CoordinatorStorage;
  kv: LiveKvNamespace;
  legacy: LegacyDocuments;
  minimumWriteIntervalMs: number;
  wait: (milliseconds: number) => Promise<void>;
  lastWriteAt: Map<string, number>;
  migrationBlockers: string[];
  blockedKeys: Set<LegacyKey>;
  blockAllWrites: boolean;
  migrationDiagnostics: MigrationDiagnostics;

  constructor(
    coordinator: CoordinatorStorage,
    kv: LiveKvNamespace,
    state: MemoryState,
    legacy: LegacyDocuments,
    migrationBlockers: string[] = [],
    blockedKeys: Set<LegacyKey> = new Set(),
    blockAllWrites = false,
    options: LiveKvStoreOptions = {},
  ) {
    super(state);
    this.authoritativeStore = "kv";
    this.coordinator = coordinator;
    this.kv = kv;
    this.legacy = legacy;
    this.minimumWriteIntervalMs = options.minimumWriteIntervalMs ?? 1_050;
    this.wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.lastWriteAt = new Map();
    this.migrationBlockers = migrationBlockers;
    this.blockedKeys = blockedKeys;
    this.blockAllWrites = blockAllWrites;
    this.migrationDiagnostics = emptyMigrationDiagnostics();
  }

  get migrationBlockerSummary(): MigrationBlockerSummaryItem[] {
    return summarizeMigrationBlockers(this.migrationBlockers);
  }

  static async open(coordinator: CoordinatorStorage, kv: LiveKvNamespace, options: LiveKvStoreOptions = {}): Promise<LiveKvStore> {
    const pending = await getChunked<PendingPublish>(coordinator, PENDING_KEY);
    if (pending?.version === 1 && Array.isArray(pending.writes)) {
      const minimumWriteIntervalMs = options.minimumWriteIntervalMs ?? 1_050;
      if (minimumWriteIntervalMs > 0) {
        const wait = options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
        await wait(minimumWriteIntervalMs);
      }
      for (const write of pending.writes) await kv.put(write.key, write.value);
      if (pending.committed) await putChunked(coordinator, COMMITTED_KEY, pending.committed);
      await deleteChunked(coordinator, PENDING_KEY);
    }

    const legacy = emptyLegacy();
    await Promise.all(LEGACY_KEYS.map(async (key) => {
      legacy[key] = await kv.get(key, "json");
    }));
    const sourceHash = await hashLegacySource(kv);
    const withDiagnostics = (store: LiveKvStore, documents: LegacyDocuments, ready?: MigrationDiagnostics): LiveKvStore => {
      store.migrationDiagnostics = { ...(ready ?? hydrateLegacyState(documents, new Date().toISOString()).diagnostics), sourceHash };
      return store;
    };
    const stored = await kv.get<StoredEnvelope>(LIVE_STATE_KEY, "json");
    const committed = await getChunked<StoredEnvelope>(coordinator, COMMITTED_KEY);
    if (committed?.version === 1) {
      const changedOrStale = LEGACY_KEYS.filter((key) => !sameDocument(legacy[key], committed.legacy[key]));
      return withDiagnostics(new LiveKvStore(
        coordinator,
        kv,
        decodeState(committed.state),
        committed.legacy,
        [
          ...hydrateLegacyState(committed.legacy, new Date().toISOString()).migrationBlockers,
          ...(changedOrStale.length > 0 ? [`external_or_stale_kv:${changedOrStale.join(",")}`] : []),
        ],
        hydrateLegacyState(committed.legacy, new Date().toISOString()).blockedKeys,
        changedOrStale.length > 0,
        options,
      ), committed.legacy);
    }
    if (stored && typeof stored === "object" && !Array.isArray(stored) && (stored as StoredEnvelope).version === 1) {
      const envelope = stored as StoredEnvelope;
      const changedOutsideMcp = LEGACY_KEYS.filter((key) => !sameDocument(legacy[key], envelope.legacy[key]));
      if (changedOutsideMcp.length === 0) {
        return withDiagnostics(new LiveKvStore(
          coordinator,
          kv,
          decodeState(envelope.state),
          envelope.legacy,
          hydrateLegacyState(envelope.legacy, new Date().toISOString()).migrationBlockers,
          hydrateLegacyState(envelope.legacy, new Date().toISOString()).blockedKeys,
          false,
          options,
        ), envelope.legacy);
      }
      const hydrated = hydrateLegacyState(legacy, new Date().toISOString());
      return withDiagnostics(new LiveKvStore(
        coordinator,
        kv,
        hydrated.state,
        legacy,
        [...hydrated.migrationBlockers, `external_kv_change:${changedOutsideMcp.join(",")}`],
        hydrated.blockedKeys,
        true,
        options,
      ), legacy, hydrated.diagnostics);
    }

    const hydrated = hydrateLegacyState(legacy, new Date().toISOString());
    return withDiagnostics(new LiveKvStore(
      coordinator,
      kv,
      hydrated.state,
      legacy,
      hydrated.migrationBlockers,
      hydrated.blockedKeys,
      false,
      options,
    ), legacy, hydrated.diagnostics);
  }

  private async putWithRateLimit(key: string, value: string): Promise<void> {
    const elapsed = Date.now() - (this.lastWriteAt.get(key) ?? 0);
    const delay = this.minimumWriteIntervalMs - elapsed;
    if (delay > 0) await this.wait(delay);
    await this.kv.put(key, value);
    this.lastWriteAt.set(key, Date.now());
  }

  async flushPending(): Promise<void> {
    const pending = await getChunked<PendingPublish>(this.coordinator, PENDING_KEY);
    if (pending?.version !== 1 || !Array.isArray(pending.writes)) return;
    for (const write of pending.writes) await this.putWithRateLimit(write.key, write.value);
    if (pending.committed) await putChunked(this.coordinator, COMMITTED_KEY, pending.committed);
    await deleteChunked(this.coordinator, PENDING_KEY);
    if (pending.legacy) this.legacy = pending.legacy;
  }

  async refreshConsistency(): Promise<void> {
    if (!this.blockAllWrites) return;
    const current = emptyLegacy();
    await Promise.all(LEGACY_KEYS.map(async (key) => {
      current[key] = await this.kv.get(key, "json");
    }));
    if (LEGACY_KEYS.every((key) => sameDocument(current[key], this.legacy[key]))) {
      this.blockAllWrites = false;
      this.migrationBlockers = this.migrationBlockers.filter((blocker) => !blocker.startsWith("external_or_stale_kv:"));
    }
  }

  async currentSourceHash(): Promise<string> {
    return hashLegacySource(this.kv);
  }

  async previewLiveReconciliation(): Promise<{
    planHash: string;
    sourceHash: string;
    affectedDocuments: Array<"orders" | "customers">;
    counts: LiveReconciliationCounts;
    blockers: string[];
  }> {
    if (this.blockAllWrites) {
      fail("MIGRATION_READ_ONLY", "Live KV changed outside MCP after canonical state was created", {
        nextAction: "Stop all writers and run an explicit reconciliation before retrying MCP writes.",
        details: { blockerCount: this.migrationBlockers.length },
      });
    }
    const sourceHash = await hashLegacySource(this.kv);
    return publicReconciliationView(await buildLiveReconciliationPlan(this.legacy, sourceHash));
  }

  async applyLiveReconciliation(expectedSourceHash: string, expectedPlanHash: string): Promise<{
    ok: true;
    planHash: string;
    sourceHash: string;
    affectedDocuments: Array<"orders" | "customers">;
    counts: LiveReconciliationCounts;
    migrationReady: boolean;
    migrationBlockerCount: number;
  }> {
    await this.flushPending();
    if (this.blockAllWrites) {
      fail("MIGRATION_READ_ONLY", "Live KV changed outside MCP after canonical state was created", {
        nextAction: "Stop all writers and run an explicit reconciliation before retrying MCP writes.",
        details: { blockerCount: this.migrationBlockers.length },
      });
    }
    const sourceHash = await hashLegacySource(this.kv);
    if (sourceHash !== expectedSourceHash) {
      fail("CONFIRMATION_STALE", "Live source changed after preview", {
        nextAction: "Preview live reconciliation again, then confirm the new plan.",
      });
    }
    const plan = await buildLiveReconciliationPlan(this.legacy, sourceHash);
    if (plan.planHash !== expectedPlanHash) {
      fail("CONFIRMATION_STALE", "Reconciliation plan changed after preview", {
        nextAction: "Preview live reconciliation again, then confirm the new plan.",
      });
    }
    if (plan.affectedDocuments.length === 0) {
      return {
        ok: true,
        planHash: plan.planHash,
        sourceHash,
        affectedDocuments: plan.affectedDocuments,
        counts: plan.counts,
        migrationReady: this.migrationBlockers.length === 0,
        migrationBlockerCount: this.migrationBlockers.length,
      };
    }
    const previousState = cloneState(this.state);
    const previousLegacy = this.legacy;
    const previousBlockers = this.migrationBlockers;
    const previousBlocked = this.blockedKeys;
    const previousDiagnostics = this.migrationDiagnostics;
    const nextLegacy = applyReconciliationPatches(this.legacy, plan);
    const hydrated = hydrateLegacyState(nextLegacy, new Date().toISOString());
    hydrated.state.generationId = previousState.generationId;
    hydrated.state.writeFence = previousState.writeFence;
    hydrated.state.principals = previousState.principals;
    hydrated.state.confirmations = previousState.confirmations;
    hydrated.state.idempotency = previousState.idempotency;
    hydrated.state.audit = previousState.audit;
    hydrated.state.backups = previousState.backups;
    hydrated.state.grants = previousState.grants;
    hydrated.state.mergeEvents = previousState.mergeEvents;
    hydrated.state.inactiveGenerations = previousState.inactiveGenerations;
    this.legacy = nextLegacy;
    this.state = hydrated.state;
    this.migrationBlockers = hydrated.migrationBlockers;
    this.blockedKeys = hydrated.blockedKeys;
    const committed = {
      version: 1 as const,
      state: encodeState(hydrated.state),
      legacy: nextLegacy,
      migrationBlockers: hydrated.migrationBlockers,
      blockedKeys: [...hydrated.blockedKeys],
      committedAt: new Date().toISOString(),
    };
    const writes = [
      { key: LIVE_STATE_KEY, value: JSON.stringify(committed) },
      { key: "orders", value: JSON.stringify(nextLegacy.orders) },
    ];
    let journaled = false;
    try {
      await putChunked(this.coordinator, PENDING_KEY, { version: 1, writes, legacy: nextLegacy, committed } satisfies PendingPublish);
      journaled = true;
      for (const write of writes) await this.putWithRateLimit(write.key, write.value);
      await putChunked(this.coordinator, COMMITTED_KEY, committed);
      await deleteChunked(this.coordinator, PENDING_KEY);
      this.migrationDiagnostics = { ...hydrated.diagnostics, sourceHash: await hashLegacySource(this.kv) };
    } catch (error) {
      if (!journaled) {
        this.state = previousState;
        this.legacy = previousLegacy;
        this.migrationBlockers = previousBlockers;
        this.blockedKeys = previousBlocked;
        this.migrationDiagnostics = previousDiagnostics;
      }
      const name = error instanceof Error ? error.name : "Error";
      const message = error instanceof Error ? error.message.slice(0, 180) : "unknown";
      fail("INTERNAL_ERROR", `Live reconciliation publish failed (${name}: ${message})`, {
        retryable: true,
        nextAction: "Preview live reconciliation again, then confirm. If journaled, the next request will roll forward.",
        details: { journaled, name },
      });
    }
    return {
      ok: true,
      planHash: plan.planHash,
      sourceHash: this.migrationDiagnostics.sourceHash,
      affectedDocuments: plan.affectedDocuments,
      counts: plan.counts,
      migrationReady: this.migrationBlockers.length === 0,
      migrationBlockerCount: this.migrationBlockers.length,
    };
  }

  async runInTransaction<T>(work: () => T | Promise<T>): Promise<T> {
    await this.flushPending();
    if (this.blockAllWrites) {
      fail("MIGRATION_READ_ONLY", "Live KV changed outside MCP after canonical state was created", {
        nextAction: "Stop all writers and run an explicit reconciliation before retrying MCP writes.",
        details: { blockerCount: this.migrationBlockers.length },
      });
    }
    const snapshot = cloneState(this.state);
    const frozenOrderIds = frozenOrderIdsFromBlockers(this.migrationBlockers);
    const before = projectLegacy(snapshot, this.legacy, frozenOrderIds);
    try {
      const result = await work();
      const after = projectLegacy(this.state, this.legacy, frozenOrderIds);
      const changed = LEGACY_KEYS.filter((key) => !sameDocument(before[key], after[key]));
      const blockedChanges = changed.filter((key) => this.blockedKeys.has(key));
      if (blockedChanges.length > 0) {
        fail("MIGRATION_READ_ONLY", "Legacy orders/customers require reconciliation before this operation can write them", {
          nextAction: "Review the migration blockers, repair customer links and legacy debt/total semantics, then retry.",
          details: { blockerCount: this.migrationBlockers.length, blockedKeys: blockedChanges },
        });
      }
      const nextLegacy = { ...this.legacy };
      for (const key of changed) nextLegacy[key] = after[key];
      const committed = {
        version: 1,
        state: encodeState(this.state),
        legacy: nextLegacy,
        migrationBlockers: this.migrationBlockers,
        blockedKeys: [...this.blockedKeys],
        committedAt: new Date().toISOString(),
      } satisfies StoredEnvelope;
      const canonical = JSON.stringify(committed);
      const writes = [
        { key: LIVE_STATE_KEY, value: canonical },
        ...changed.map((key) => ({ key, value: JSON.stringify(after[key]) })),
      ];
      let journaled = false;
      try {
        await putChunked(this.coordinator, PENDING_KEY, { version: 1, writes, legacy: nextLegacy, committed } satisfies PendingPublish);
        journaled = true;
        for (const write of writes) await this.putWithRateLimit(write.key, write.value);
        await putChunked(this.coordinator, COMMITTED_KEY, committed);
        await deleteChunked(this.coordinator, PENDING_KEY);
        this.legacy = nextLegacy;
      } catch (error) {
        throw new PublishError(error, journaled);
      }
      return result;
    } catch (error) {
      if (!(error instanceof PublishError) || !error.journaled) this.state = snapshot;
      throw error;
    }
  }
}
