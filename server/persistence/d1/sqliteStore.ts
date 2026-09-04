import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { applySql } from "./migrate.ts";
import { cloneState, createMemoryState, MemoryStore, type MemoryState } from "../memory/store.ts";

const TABLES = [
  "payment_reversals",
  "payment_refunds",
  "cash_transaction_reversals",
  "order_status_events",
  "projection_outbox",
  "product_variants",
  "order_lines",
  "principal_scope_grants",
  "payments",
  "cash_transactions",
  "audit_events",
  "idempotency_records",
  "confirmation_intents",
  "products",
  "orders",
  "shop_templates",
  "customer_merge_events",
  "backup_manifests",
  "customers",
  "categories",
  "principals",
  "active_dataset",
  "maintenance_leases",
  "dataset_generations",
  "app_settings",
];

const run = (db: DatabaseSync, sql: string, params: SQLInputValue[] = []) => db.prepare(sql).run(...params);
const all = <T>(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): T[] => db.prepare(sql).all(...params) as T[];

export const persistState = (db: DatabaseSync, state: MemoryState): void => {
  db.exec("PRAGMA foreign_keys = OFF");
  for (const table of TABLES) db.exec(`DELETE FROM ${table}`);
  run(db, "INSERT INTO dataset_generations (id, created_at, active) VALUES (?, ?, 1)", [state.generationId, new Date().toISOString()]);
  run(db, "INSERT INTO active_dataset (lock_id, generation_id) VALUES (1, ?)", [state.generationId]);
  run(db, "INSERT INTO app_settings (key, value_json, revision) VALUES ('writeFence', ?, 1)", [JSON.stringify(state.writeFence)]);
  run(db, "INSERT INTO app_settings (key, value_json, revision) VALUES ('phone', ?, ?)", [JSON.stringify(state.phone), state.phone.revision]);
  run(db, "INSERT INTO app_settings (key, value_json, revision) VALUES ('shop', ?, ?)", [JSON.stringify(state.shop), state.shop.revision]);
  run(db, "INSERT INTO app_settings (key, value_json, revision) VALUES ('bank', ?, ?)", [JSON.stringify(state.bank), state.bank.revision]);
  run(db, "INSERT INTO app_settings (key, value_json, revision) VALUES ('tax', ?, ?)", [JSON.stringify(state.tax), state.tax.revision]);

  for (const category of state.categories.values()) {
    run(db, `INSERT INTO categories (id, dataset_generation_id, label, value, archived, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      category.id, category.datasetGenerationId, category.label, category.value,
      category.archived ? 1 : 0, category.revision, category.createdAt, category.updatedAt,
    ]);
  }
  for (const product of state.products.values()) {
    run(db, `INSERT INTO products (id, dataset_generation_id, category_id, name, description, image, is_hot, archived, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      product.id, product.datasetGenerationId, product.categoryId, product.name, product.description, product.image,
      product.isHot ? 1 : 0, product.archived ? 1 : 0, product.revision, product.createdAt, product.updatedAt,
    ]);
    for (const variant of product.variants) {
      run(db, "INSERT INTO product_variants (product_id, size, unit, price, cost_price) VALUES (?, ?, ?, ?, ?)", [
        product.id, variant.size, variant.unit, variant.price, variant.costPrice,
      ]);
    }
  }
  for (const customer of state.customers.values()) {
    run(db, `INSERT INTO customers (id, dataset_generation_id, name, phone, address, archived, revision, merged_into_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      customer.id, customer.datasetGenerationId, customer.name, customer.phone, customer.address,
      customer.archived ? 1 : 0, customer.revision, customer.mergedIntoId, customer.createdAt, customer.updatedAt,
    ]);
  }
  for (const event of state.mergeEvents.values()) {
    run(db, `INSERT INTO customer_merge_events (id, dataset_generation_id, canonical_customer_id, source_customer_id, reversed, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [
      event.id, event.datasetGenerationId, event.canonicalCustomerId, event.sourceCustomerId, event.reversed ? 1 : 0, event.createdAt,
    ]);
  }
  for (const order of state.orders.values()) {
    run(db, `INSERT INTO orders (id, dataset_generation_id, customer_id, contact_name, contact_phone, contact_address, status, discount, shipping_fee, note, shop_template_id, seller_snapshot_json, payment_method, revision, discarded, cancel_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      order.id, order.datasetGenerationId, order.customerId, order.contact.name, order.contact.phone, order.contact.address,
      order.status, order.discount, order.shippingFee, order.note, order.shopTemplateId, JSON.stringify(order.sellerSnapshot),
      order.paymentMethod, order.revision, order.discarded ? 1 : 0, order.cancelReason, order.createdAt, order.updatedAt,
    ]);
    for (const line of order.items) {
      run(db, `INSERT INTO order_lines (id, order_id, product_id, name, unit, quantity, so_cuon, so_ki, unit_price, cost_price, is_manual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        line.id, order.id, line.productId, line.name, line.unit, line.quantity, line.soCuon, line.soKi,
        line.unitPrice, line.costPrice, line.isManual ? 1 : 0,
      ]);
    }
  }
  for (const payment of state.payments.values()) {
    run(db, `INSERT INTO payments (id, dataset_generation_id, order_id, amount, reversed_amount, refunded_amount, method, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      payment.id, payment.datasetGenerationId, payment.orderId, payment.amount, payment.reversedAmount,
      payment.refundedAmount, payment.method, payment.note, payment.createdAt,
    ]);
  }
  for (const cash of state.cash.values()) {
    run(db, `INSERT INTO cash_transactions (id, dataset_generation_id, type, amount, reversed_amount, description, category, date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      cash.id, cash.datasetGenerationId, cash.type, cash.amount, cash.reversedAmount, cash.description, cash.category, cash.date, cash.createdAt,
    ]);
  }
  for (const template of state.templates.values()) {
    run(db, `INSERT INTO shop_templates (id, dataset_generation_id, name, address, phone, is_default, archived, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      template.id, template.datasetGenerationId, template.name, template.address, template.phone,
      template.isDefault ? 1 : 0, template.archived ? 1 : 0, template.revision, template.createdAt, template.updatedAt,
    ]);
  }
  for (const principal of state.principals.values()) {
    run(db, "INSERT INTO principals (id, github_user_id, active) VALUES (?, ?, ?)", [
      principal.id, principal.githubUserId, principal.active ? 1 : 0,
    ]);
    for (const scope of principal.scopes) {
      run(db, "INSERT INTO principal_scope_grants (principal_id, scope) VALUES (?, ?)", [principal.id, scope]);
    }
  }
  for (const record of state.idempotency.values()) {
    run(db, `INSERT INTO idempotency_records (principal_id, operation_id, idempotency_key, payload_hash, result_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`, [
      record.principalId, record.operationId, record.key.split(":").slice(2).join(":"), record.payloadHash,
      JSON.stringify(record.result), record.createdAt,
    ]);
  }
  for (const intent of state.confirmations.values()) {
    run(db, `INSERT INTO confirmation_intents (token, principal_id, client_id, operation_id, payload_hash, expires_at, consumed_at, input_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      intent.token, intent.principalId, intent.clientId, intent.operationId, intent.payloadHash,
      intent.expiresAt, intent.consumedAt, JSON.stringify({ input: intent.input, expectedRevisions: intent.expectedRevisions, scopes: intent.scopes, targetIds: intent.targetIds, impactSummary: intent.impactSummary }),
    ]);
  }
  for (const event of state.audit) {
    run(db, `INSERT INTO audit_events (id, at, actor, channel, operation_id, target_ids_json, outcome, request_id, dataset_generation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      event.id, event.at, event.actor, event.channel, event.operationId, JSON.stringify(event.targetIds),
      event.outcome, event.requestId, event.datasetGenerationId,
    ]);
  }
  for (const backup of state.backups.values()) {
    run(db, `INSERT INTO backup_manifests (id, status, schema_version, created_at, byte_length, checksum_sha256, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      backup.id, backup.status, backup.schemaVersion, backup.createdAt, backup.byteLength, backup.checksumSha256, backup.payload,
    ]);
  }
  db.exec("PRAGMA foreign_keys = ON");
};

export const hydrateState = (db: DatabaseSync): MemoryState | null => {
  const active = all<{ generation_id: string }>(db, "SELECT generation_id FROM active_dataset WHERE lock_id = 1")[0];
  if (!active) return null;
  const state = createMemoryState();
  state.generationId = active.generation_id;
  const settings = all<{ key: string; value_json: string; revision: number }>(db, "SELECT key, value_json, revision FROM app_settings");
  for (const row of settings) {
    if (row.key === "writeFence") state.writeFence = JSON.parse(row.value_json);
    if (row.key === "phone") state.phone = JSON.parse(row.value_json);
    if (row.key === "shop") state.shop = JSON.parse(row.value_json);
    if (row.key === "bank") state.bank = JSON.parse(row.value_json);
    if (row.key === "tax") state.tax = JSON.parse(row.value_json);
  }
  for (const row of all<any>(db, "SELECT * FROM categories")) {
    state.categories.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, label: row.label, value: row.value,
      archived: Boolean(row.archived), revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
    });
  }
  const variants = all<any>(db, "SELECT * FROM product_variants");
  for (const row of all<any>(db, "SELECT * FROM products")) {
    state.products.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, categoryId: row.category_id, name: row.name,
      description: row.description, image: row.image, isHot: Boolean(row.is_hot), archived: Boolean(row.archived),
      revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at,
      variants: variants.filter((variant) => variant.product_id === row.id).map((variant) => ({
        size: variant.size, unit: variant.unit, price: variant.price, costPrice: variant.cost_price,
      })),
    });
  }
  for (const row of all<any>(db, "SELECT * FROM customers")) {
    state.customers.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, name: row.name, phone: row.phone, address: row.address,
      archived: Boolean(row.archived), revision: row.revision, mergedIntoId: row.merged_into_id,
      createdAt: row.created_at, updatedAt: row.updated_at,
    });
  }
  for (const row of all<any>(db, "SELECT * FROM customer_merge_events")) {
    state.mergeEvents.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, canonicalCustomerId: row.canonical_customer_id,
      sourceCustomerId: row.source_customer_id, reversed: Boolean(row.reversed), createdAt: row.created_at,
    });
  }
  const lines = all<any>(db, "SELECT * FROM order_lines");
  for (const row of all<any>(db, "SELECT * FROM orders")) {
    state.orders.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, customerId: row.customer_id,
      contact: { name: row.contact_name, phone: row.contact_phone, address: row.contact_address },
      status: row.status, discount: row.discount, shippingFee: row.shipping_fee, note: row.note,
      shopTemplateId: row.shop_template_id,
      sellerSnapshot: row.seller_snapshot_json ? JSON.parse(row.seller_snapshot_json) : null,
      paymentMethod: row.payment_method,
      revision: row.revision, discarded: Boolean(row.discarded), cancelReason: row.cancel_reason,
      createdAt: row.created_at, updatedAt: row.updated_at,
      items: lines.filter((line) => line.order_id === row.id).map((line) => ({
        id: line.id, productId: line.product_id, name: line.name, unit: line.unit, quantity: line.quantity,
        soCuon: line.so_cuon, soKi: line.so_ki, unitPrice: line.unit_price, costPrice: line.cost_price,
        isManual: Boolean(line.is_manual),
      })),
    });
  }
  for (const row of all<any>(db, "SELECT * FROM payments")) {
    state.payments.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, orderId: row.order_id, amount: row.amount,
      reversedAmount: row.reversed_amount, refundedAmount: row.refunded_amount, method: row.method,
      note: row.note, createdAt: row.created_at,
    });
  }
  for (const row of all<any>(db, "SELECT * FROM cash_transactions")) {
    state.cash.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, type: row.type, amount: row.amount,
      reversedAmount: row.reversed_amount, description: row.description, category: row.category,
      date: row.date, createdAt: row.created_at,
    });
  }
  for (const row of all<any>(db, "SELECT * FROM shop_templates")) {
    state.templates.set(row.id, {
      id: row.id, datasetGenerationId: row.dataset_generation_id, name: row.name, address: row.address, phone: row.phone,
      isDefault: Boolean(row.is_default), archived: Boolean(row.archived), revision: row.revision,
      createdAt: row.created_at, updatedAt: row.updated_at,
    });
  }
  const grants = all<{ principal_id: string; scope: string }>(db, "SELECT principal_id, scope FROM principal_scope_grants");
  for (const row of all<any>(db, "SELECT * FROM principals")) {
    state.principals.set(row.id, {
      id: row.id,
      githubUserId: row.github_user_id,
      active: Boolean(row.active),
      scopes: grants.filter((grant) => grant.principal_id === row.id).map((grant) => grant.scope as never),
    });
  }
  for (const row of all<any>(db, "SELECT * FROM idempotency_records")) {
    const key = `${row.principal_id}:${row.operation_id}:${row.idempotency_key}`;
    state.idempotency.set(key, {
      key, principalId: row.principal_id, operationId: row.operation_id, payloadHash: row.payload_hash,
      result: JSON.parse(row.result_json), createdAt: row.created_at,
    });
  }
  for (const row of all<any>(db, "SELECT * FROM confirmation_intents")) {
    const extra = JSON.parse(row.input_json ?? "{}");
    state.confirmations.set(row.token, {
      token: row.token, principalId: row.principal_id, clientId: row.client_id, operationId: row.operation_id,
      payloadHash: row.payload_hash, expiresAt: row.expires_at, consumedAt: row.consumed_at,
      input: extra.input, expectedRevisions: extra.expectedRevisions ?? {}, scopes: extra.scopes ?? [],
      targetIds: extra.targetIds ?? [], impactSummary: extra.impactSummary ?? "",
    });
  }
  for (const row of all<any>(db, "SELECT * FROM audit_events")) {
    state.audit.push({
      id: row.id, at: row.at, actor: row.actor, channel: row.channel, operationId: row.operation_id,
      targetIds: JSON.parse(row.target_ids_json), outcome: row.outcome, requestId: row.request_id,
      datasetGenerationId: row.dataset_generation_id,
    });
  }
  for (const row of all<any>(db, "SELECT * FROM backup_manifests")) {
    state.backups.set(row.id, {
      id: row.id, status: row.status, schemaVersion: row.schema_version, createdAt: row.created_at,
      byteLength: row.byte_length, checksumSha256: row.checksum_sha256, payload: row.payload, sectionCounts: {},
    });
  }
  return state;
};

export class SqliteStore extends MemoryStore {
  db: DatabaseSync;
  failNextPersist = false;

  constructor(db = new DatabaseSync(":memory:")) {
    super();
    this.db = db;
    db.exec("PRAGMA foreign_keys = ON");
    const migrated = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='active_dataset'").all();
    if (migrated.length === 0) applySql((sql) => db.exec(sql));
    const loaded = hydrateState(db);
    if (loaded) this.state = loaded;
    else persistState(db, this.state);
  }

  async runInTransaction<T>(work: () => T | Promise<T>): Promise<T> {
    const snapshot = cloneState(this.state);
    this.db.exec("BEGIN");
    try {
      const result = await work();
      if (this.failNextPersist) {
        this.failNextPersist = false;
        throw new Error("injected persist failure");
      }
      persistState(this.db, this.state);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.state = snapshot;
      throw error;
    }
  }

  reopen(): SqliteStore {
    persistState(this.db, this.state);
    const next = new SqliteStore(this.db);
    next.failNextPersist = this.failNextPersist;
    return next;
  }
}
