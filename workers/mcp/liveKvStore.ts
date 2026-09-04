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
import { computeOrderTotals, netCollected, outstandingForOrder } from "../../server/domain/index.ts";
import { fail } from "../../server/domain/errors.ts";
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

const hydrateLegacyState = (legacy: LegacyDocuments, now: string): {
  state: MemoryState;
  migrationBlockers: string[];
  blockedKeys: Set<LegacyKey>;
} => {
  const state = createMemoryState(now);
  const migrationBlockers: string[] = [];
  const blockedKeys = new Set<LegacyKey>();
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

  const orderIds = new Set<string>();
  asArray(legacy.orders).forEach((row, orderIndex) => {
    const id = stringOr(row.id, `legacy_order_${orderIndex}`);
    if (!stringOr(row.id) || orderIds.has(id)) addBlocker(`order:${id}:missing_or_duplicate_id`, "orders", "customers");
    if (orderIds.has(id)) return;
    orderIds.add(id);
    let customerId = stringOr(row.customerId);
    if (!customerId || !state.customers.has(customerId)) {
      addBlocker(`order:${id}:customer_id_requires_review`, "orders", "customers");
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
    if (legacyDebt > 0 || legacyTotal !== totals.total) {
      addBlocker(`order:${id}:legacy_total_or_debt_requires_review`, "orders", "customers");
    }
    const treatedPaid = status !== "cancelled" && status !== "discarded" && row.paymentStatus !== "unpaid" && legacyDebt === 0;
    if (treatedPaid && totals.total > 0) {
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
  return { state, migrationBlockers, blockedKeys };
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
  new Map(asArray(value).map((row) => [stringOr(row.id ?? row.productId), row]).filter(([id]) => Boolean(id)));

const projectLegacy = (state: MemoryState, base: LegacyDocuments): LegacyDocuments => {
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
  const orders = liveOrders.map((order) => {
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

  const stats = new Map<string, { totalSpent: number; lastOrderDate: string; orderCount: number; debt: number }>();
  for (const order of liveOrders.filter((row) => row.status !== "cancelled" && row.status !== "discarded")) {
    const totals = orderTotals(state, order);
    const current = stats.get(order.customerId) ?? { totalSpent: 0, lastOrderDate: "", orderCount: 0, debt: 0 };
    current.totalSpent += totals.total;
    current.orderCount += 1;
    current.debt += totals.outstanding;
    if (order.createdAt > current.lastOrderDate) current.lastOrderDate = order.createdAt;
    stats.set(order.customerId, current);
  }
  const oldCustomers = mergeById(base.customers);
  const customers = active(state.customers.values(), state).filter((row) => !row.archived && !row.mergedIntoId).map((row) => ({
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
  }

  static async open(coordinator: CoordinatorStorage, kv: LiveKvNamespace, options: LiveKvStoreOptions = {}): Promise<LiveKvStore> {
    const pending = await coordinator.get<PendingPublish>(PENDING_KEY);
    if (pending?.version === 1 && Array.isArray(pending.writes)) {
      const minimumWriteIntervalMs = options.minimumWriteIntervalMs ?? 1_050;
      if (minimumWriteIntervalMs > 0) {
        const wait = options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
        await wait(minimumWriteIntervalMs);
      }
      for (const write of pending.writes) await kv.put(write.key, write.value);
      if (pending.committed) await coordinator.put(COMMITTED_KEY, pending.committed);
      await coordinator.delete(PENDING_KEY);
    }

    const legacy = emptyLegacy();
    await Promise.all(LEGACY_KEYS.map(async (key) => {
      legacy[key] = await kv.get(key, "json");
    }));
    const stored = await kv.get<StoredEnvelope>(LIVE_STATE_KEY, "json");
    const committed = await coordinator.get<StoredEnvelope>(COMMITTED_KEY);
    if (committed?.version === 1) {
      const changedOrStale = LEGACY_KEYS.filter((key) => !sameDocument(legacy[key], committed.legacy[key]));
      return new LiveKvStore(
        coordinator,
        kv,
        decodeState(committed.state),
        committed.legacy,
        [
          ...(committed.migrationBlockers ?? []),
          ...(changedOrStale.length > 0 ? [`external_or_stale_kv:${changedOrStale.join(",")}`] : []),
        ],
        new Set(committed.blockedKeys ?? []),
        changedOrStale.length > 0,
        options,
      );
    }
    if (stored && typeof stored === "object" && !Array.isArray(stored) && (stored as StoredEnvelope).version === 1) {
      const envelope = stored as StoredEnvelope;
      const changedOutsideMcp = LEGACY_KEYS.filter((key) => !sameDocument(legacy[key], envelope.legacy[key]));
      if (changedOutsideMcp.length === 0) {
        return new LiveKvStore(
          coordinator,
          kv,
          decodeState(envelope.state),
          envelope.legacy,
          envelope.migrationBlockers ?? [],
          new Set(envelope.blockedKeys ?? []),
          false,
          options,
        );
      }
      const hydrated = hydrateLegacyState(legacy, new Date().toISOString());
      return new LiveKvStore(
        coordinator,
        kv,
        hydrated.state,
        legacy,
        [...hydrated.migrationBlockers, `external_kv_change:${changedOutsideMcp.join(",")}`],
        hydrated.blockedKeys,
        true,
        options,
      );
    }

    const hydrated = hydrateLegacyState(legacy, new Date().toISOString());
    return new LiveKvStore(
      coordinator,
      kv,
      hydrated.state,
      legacy,
      hydrated.migrationBlockers,
      hydrated.blockedKeys,
      false,
      options,
    );
  }

  private async putWithRateLimit(key: string, value: string): Promise<void> {
    const elapsed = Date.now() - (this.lastWriteAt.get(key) ?? 0);
    const delay = this.minimumWriteIntervalMs - elapsed;
    if (delay > 0) await this.wait(delay);
    await this.kv.put(key, value);
    this.lastWriteAt.set(key, Date.now());
  }

  async flushPending(): Promise<void> {
    const pending = await this.coordinator.get<PendingPublish>(PENDING_KEY);
    if (pending?.version !== 1 || !Array.isArray(pending.writes)) return;
    for (const write of pending.writes) await this.putWithRateLimit(write.key, write.value);
    if (pending.committed) await this.coordinator.put(COMMITTED_KEY, pending.committed);
    await this.coordinator.delete(PENDING_KEY);
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

  async runInTransaction<T>(work: () => T | Promise<T>): Promise<T> {
    await this.flushPending();
    if (this.blockAllWrites) {
      fail("MIGRATION_READ_ONLY", "Live KV changed outside MCP after canonical state was created", {
        nextAction: "Stop all writers and run an explicit reconciliation before retrying MCP writes.",
        details: { blockerCount: this.migrationBlockers.length },
      });
    }
    const snapshot = cloneState(this.state);
    const before = projectLegacy(snapshot, this.legacy);
    try {
      const result = await work();
      const after = projectLegacy(this.state, this.legacy);
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
        await this.coordinator.put(PENDING_KEY, { version: 1, writes, legacy: nextLegacy, committed } satisfies PendingPublish);
        journaled = true;
        for (const write of writes) await this.putWithRateLimit(write.key, write.value);
        await this.coordinator.put(COMMITTED_KEY, committed);
        await this.coordinator.delete(PENDING_KEY);
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
