import { fail } from "../../domain/errors.ts";
import type { OrderStatus } from "../../domain/lifecycle.ts";
import type { Vnd } from "../../domain/money.ts";
import type { Scope } from "../../application/registry.ts";

export interface ProductRecord {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  image: string;
  isHot: boolean;
  variants: { size: string; unit: string; price: Vnd; costPrice: Vnd }[];
  archived: boolean;
  revision: number;
  datasetGenerationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRecord {
  id: string;
  label: string;
  value: string;
  archived: boolean;
  revision: number;
  datasetGenerationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  address: string;
  archived: boolean;
  revision: number;
  mergedIntoId: string | null;
  datasetGenerationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MergeEventRecord {
  id: string;
  canonicalCustomerId: string;
  sourceCustomerId: string;
  reversed: boolean;
  datasetGenerationId: string;
  createdAt: string;
}

export interface OrderLineRecord {
  id: string;
  productId: string | null;
  name: string;
  unit: string;
  quantity: number;
  soCuon: number | null;
  soKi: number | null;
  unitPrice: Vnd;
  costPrice: Vnd;
  isManual: boolean;
}

export interface OrderRecord {
  id: string;
  customerId: string;
  contact: { name: string; phone: string; address: string };
  items: OrderLineRecord[];
  status: OrderStatus;
  discount: Vnd;
  shippingFee: Vnd;
  note: string;
  shopTemplateId: string | null;
  sellerSnapshot: Record<string, unknown> | null;
  paymentMethod: "cod" | "banking";
  revision: number;
  discarded: boolean;
  cancelReason: string | null;
  datasetGenerationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: Vnd;
  reversedAmount: Vnd;
  refundedAmount: Vnd;
  method: string;
  note: string;
  datasetGenerationId: string;
  createdAt: string;
}

export interface CashRecord {
  id: string;
  type: "income" | "expense";
  amount: Vnd;
  reversedAmount: Vnd;
  description: string;
  category: string;
  date: string;
  datasetGenerationId: string;
  createdAt: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  isDefault: boolean;
  archived: boolean;
  revision: number;
  datasetGenerationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmationRecord {
  token: string;
  principalId: string;
  clientId: string;
  operationId: string;
  payloadHash: string;
  scopes: Scope[];
  targetIds: string[];
  expectedRevisions: Record<string, number>;
  impactSummary: string;
  input: unknown;
  expiresAt: string;
  consumedAt: string | null;
}

export interface IdempotencyRecord {
  key: string;
  principalId: string;
  operationId: string;
  payloadHash: string;
  result: unknown;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  at: string;
  actor: string;
  channel: string;
  operationId: string;
  targetIds: string[];
  outcome: string;
  requestId: string;
  datasetGenerationId: string;
}

export interface BackupRecord {
  id: string;
  status: string;
  schemaVersion: string;
  createdAt: string;
  byteLength: number;
  checksumSha256: string;
  payload: string;
  sectionCounts: Record<string, number>;
}

export interface MemoryState {
  generationId: string;
  writeFence: boolean;
  products: Map<string, ProductRecord>;
  categories: Map<string, CategoryRecord>;
  customers: Map<string, CustomerRecord>;
  mergeEvents: Map<string, MergeEventRecord>;
  orders: Map<string, OrderRecord>;
  payments: Map<string, PaymentRecord>;
  cash: Map<string, CashRecord>;
  templates: Map<string, TemplateRecord>;
  phone: { phoneNumber: string; revision: number };
  shop: { name: string; address: string; revision: number };
  bank: { bankName: string; accountNumber: string; accountName: string; qrCodeUrl: string; revision: number };
  tax: { rate: number; revision: number };
  principals: Map<string, { id: string; githubUserId: string; active: boolean; scopes: Scope[] }>;
  confirmations: Map<string, ConfirmationRecord>;
  idempotency: Map<string, IdempotencyRecord>;
  audit: AuditRecord[];
  backups: Map<string, BackupRecord>;
  grants: Map<string, { grantId: string; artifactId: string; direction: "upload" | "download"; expiresAt: string; used: boolean }>;
  inactiveGenerations: Map<string, MemoryState>;
}

const cloneState = (state: MemoryState): MemoryState => structuredClone(state);

export const createMemoryState = (now = new Date().toISOString()): MemoryState => ({
  generationId: "gen_1",
  writeFence: false,
  products: new Map(),
  categories: new Map(),
  customers: new Map(),
  mergeEvents: new Map(),
  orders: new Map(),
  payments: new Map(),
  cash: new Map(),
  templates: new Map(),
  phone: { phoneNumber: "0901234567", revision: 1 },
  shop: { name: "Kho Si Huy Thao", address: "", revision: 1 },
  bank: { bankName: "", accountNumber: "", accountName: "", qrCodeUrl: "", revision: 1 },
  tax: { rate: 0, revision: 1 },
  principals: new Map([
    ["principal_owner", { id: "principal_owner", githubUserId: "0", active: true, scopes: [] }],
  ]),
  confirmations: new Map(),
  idempotency: new Map(),
  audit: [],
  backups: new Map(),
  grants: new Map(),
  inactiveGenerations: new Map(),
});

export class MemoryStore {
  state: MemoryState;
  authoritativeStore: "kv" | "d1";

  constructor(state = createMemoryState()) {
    this.state = state;
    this.authoritativeStore = "d1";
  }

  requireWritable(): void {
    if (this.state.writeFence) fail("MIGRATION_READ_ONLY", "Writes are fenced during restore");
  }

  bump<T extends { revision: number }>(record: T, expected?: number): T {
    if (expected !== undefined && record.revision !== expected) {
      fail("REVISION_CONFLICT", "Stale revision", {
        nextAction: "Reload and retry with the current revision.",
      });
    }
    record.revision += 1;
    return record;
  }

  runInTransaction<T>(work: () => T | Promise<T>): Promise<T> {
    return Promise.resolve().then(work);
  }
}

export { cloneState };
