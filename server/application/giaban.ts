import {
  ALL_SCOPES,
  LEGACY_OPERATION_ALLOWLIST,
  OPERATIONS,
  operationById,
  type Scope,
} from "./registry.ts";
import {
  DomainError,
  assertCanCancel,
  assertCanDiscardDraft,
  assertCustomerWrite,
  assertDraftEditable,
  assertPaymentAllowed,
  assertPublicProjection,
  assertVariant,
  computeOrderTotals,
  duplicatePhoneWarning,
  fail,
  maskName,
  maskPhone,
  netCollected,
  outstandingForOrder,
  paginate,
  publicProductFromAdmin,
  remainingConsumable,
  applyConsumption,
  summarizeOrders,
  transitionOrder,
  inBusinessRange,
  effectiveQuantity,
  BUSINESS_TIMEZONE,
} from "../domain/index.ts";
import { canonicalJson, sha256Hex } from "../safety/canonical.ts";
import type { InvocationContext } from "../safety/assertion.ts";
import {
  cloneState,
  MemoryStore,
  type CustomerRecord,
  type OrderRecord,
  type PaymentRecord,
  type ProductRecord,
} from "../persistence/memory/store.ts";

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const requireScopes = (context: InvocationContext, scopes: Scope[]): void => {
  for (const scope of scopes) {
    if (!context.scopes.includes(scope)) {
      fail("FORBIDDEN", `Missing scope ${scope}`, { nextAction: `Request scope ${scope} and retry.` });
    }
  }
};

const activeCustomers = (store: MemoryStore): CustomerRecord[] =>
  [...store.state.customers.values()].filter((customer) => customer.datasetGenerationId === store.state.generationId);

const activeProducts = (store: MemoryStore): ProductRecord[] =>
  [...store.state.products.values()].filter((product) => product.datasetGenerationId === store.state.generationId);

const activeOrders = (store: MemoryStore): OrderRecord[] =>
  [...store.state.orders.values()].filter((order) => order.datasetGenerationId === store.state.generationId);

const paymentsFor = (store: MemoryStore, orderId: string): PaymentRecord[] =>
  [...store.state.payments.values()].filter(
    (payment) => payment.orderId === orderId && payment.datasetGenerationId === store.state.generationId,
  );

const orderMoney = (store: MemoryStore, order: OrderRecord) => {
  const totals = computeOrderTotals(
    order.items.map((item) => ({
      quantity: item.quantity,
      soCuon: item.soCuon,
      soKi: item.soKi,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
    })),
    order.discount,
    order.shippingFee,
  );
  const collected = netCollected(paymentsFor(store, order.id));
  return {
    ...totals,
    netCollected: collected,
    outstanding: outstandingForOrder(totals.total, collected, order.status),
  };
};

const maskCustomer = (customer: CustomerRecord, others: CustomerRecord[]) => ({
  id: customer.id,
  displayName: maskName(customer.name),
  phoneMasked: maskPhone(customer.phone),
  archived: customer.archived,
  revision: customer.revision,
  duplicatePhoneWarning: duplicatePhoneWarning(
    customer.phone,
    others.filter((other) => other.id !== customer.id).map((other) => other.phone),
  ),
  createdAt: customer.createdAt,
});

const customerDetail = (customer: CustomerRecord, others: CustomerRecord[]) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
  address: customer.address,
  archived: customer.archived,
  revision: customer.revision,
  mergedIntoId: customer.mergedIntoId,
  duplicatePhoneWarning: duplicatePhoneWarning(
    customer.phone,
    others.filter((other) => other.id !== customer.id).map((other) => other.phone),
  ),
});

const maskOrder = (store: MemoryStore, order: OrderRecord) => {
  const money = orderMoney(store, order);
  return {
    id: order.id,
    customerId: order.customerId,
    contact: { displayName: maskName(order.contact.name), phoneMasked: maskPhone(order.contact.phone) },
    status: order.status,
    total: money.total,
    outstanding: money.outstanding,
    netCollected: money.netCollected,
    revision: order.revision,
    createdAt: order.createdAt,
  };
};

const orderDetail = (store: MemoryStore, order: OrderRecord) => {
  const money = orderMoney(store, order);
  return {
    id: order.id,
    customerId: order.customerId,
    contact: order.contact,
    items: order.items.map((item) => {
      const lineTotals = computeOrderTotals([
        {
          quantity: item.quantity,
          soCuon: item.soCuon,
          soKi: item.soKi,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
        },
      ]);
      return {
        ...item,
        effectiveQuantity: effectiveQuantity({
          quantity: item.quantity,
          soCuon: item.soCuon,
          soKi: item.soKi,
        }),
        saleSubtotal: lineTotals.lineSubtotal,
        cogs: lineTotals.cogs,
      };
    }),
    status: order.status,
    lineSubtotal: money.lineSubtotal,
    discount: money.discount,
    shippingFee: money.shippingFee,
    total: money.total,
    outstanding: money.outstanding,
    netCollected: money.netCollected,
    note: order.note,
    shopTemplateId: order.shopTemplateId,
    sellerSnapshot: order.sellerSnapshot,
    paymentMethod: order.paymentMethod,
    revision: order.revision,
    createdAt: order.createdAt,
    discarded: order.discarded,
  };
};

const paymentView = (payment: PaymentRecord) => ({
  ...payment,
  remaining: remainingConsumable(payment),
});

export class GiabanApplication {
  store: MemoryStore;
  constructor(store: MemoryStore) {
    this.store = store;
    const owner = store.state.principals.get("principal_owner");
    if (owner && owner.scopes.length === 0) owner.scopes = [...ALL_SCOPES];
  }

  async query(request: { operationId: string; input?: unknown }, context: InvocationContext) {
    return this.invoke("query", request.operationId, request.input ?? {}, context);
  }

  async execute(request: { operationId: string; input?: unknown }, context: InvocationContext) {
    return this.invoke("command", request.operationId, request.input ?? {}, context);
  }

  async preview(request: { operationId: string; input?: unknown }, context: InvocationContext) {
    return this.invoke("preview", request.operationId, request.input ?? {}, context);
  }

  async confirm(request: { operationId: string; input?: unknown }, context: InvocationContext) {
    return this.invoke("confirm", request.operationId, request.input ?? {}, context);
  }

  async invoke(expectedKind: string, operationId: string, input: unknown, context: InvocationContext) {
    const policy = operationById.get(operationId);
    if (!policy) fail("NOT_FOUND", `Unknown operation ${operationId}`);
    if (policy.kind !== expectedKind) fail("VALIDATION_ERROR", `Use ${policy.kind} for ${operationId}`);
    if (context.legacy && !policy.public && !LEGACY_OPERATION_ALLOWLIST.has(operationId)) {
      fail("FORBIDDEN", "Legacy sessions cannot invoke this operation");
    }
    const principal = this.store.state.principals.get(context.principalId);
    if (!policy.public && !context.legacy && (!principal || !principal.active)) {
      fail("UNAUTHENTICATED", "Principal is not active");
    }
    const granted = new Set(context.legacy || policy.public ? context.scopes : (principal?.scopes ?? context.scopes));
    const effective = context.scopes.filter((scope) => granted.has(scope) || context.legacy || policy.public);
    const authorized: InvocationContext = { ...context, scopes: effective as Scope[] };
    if (!policy.public) requireScopes(authorized, policy.scopes);

    if (policy.retryable && authorized.idempotencyKey) {
      const replay = this.replay(authorized, operationId, input);
      if (replay) return replay;
    }
    if (
      policy.kind !== "query" &&
      this.store.state.writeFence &&
      operationId !== "previewRestore" &&
      operationId !== "confirmRestore"
    ) {
      fail("MIGRATION_READ_ONLY", "Writes are fenced during restore");
    }

    const run = async () => {
      const result = await this.dispatch(operationId, input as Record<string, unknown>, authorized);
      if (policy.sensitiveRead) {
        this.audit(authorized, operationId, "sensitive-read", [(input as { id?: string }).id ?? ""]);
      } else if (policy.kind !== "query") {
        this.audit(authorized, operationId, "ok", this.targetIds(input));
      }
      if (policy.retryable && authorized.idempotencyKey) {
        this.remember(authorized, operationId, input, result);
      }
      return result;
    };

    try {
      if (policy.kind === "query" && !policy.sensitiveRead) return await run();
      return await this.store.runInTransaction(run);
    } catch (error) {
      this.audit(authorized, operationId, error instanceof DomainError ? error.code : "INTERNAL_ERROR", this.targetIds(input));
      throw error;
    }
  }

  private replay(context: InvocationContext, operationId: string, input: unknown) {
    const key = `${context.principalId}:${operationId}:${context.idempotencyKey}`;
    const existing = this.store.state.idempotency.get(key);
    if (!existing) return null;
    const hash = canonicalJson(input);
    if (existing.payloadHash !== hash) fail("IDEMPOTENCY_CONFLICT", "Idempotency key reused with a different payload");
    return existing.result;
  }

  private remember(context: InvocationContext, operationId: string, input: unknown, result: unknown) {
    const key = `${context.principalId}:${operationId}:${context.idempotencyKey}`;
    this.store.state.idempotency.set(key, {
      key,
      principalId: context.principalId,
      operationId,
      payloadHash: canonicalJson(input),
      result,
      createdAt: context.now.toISOString(),
    });
  }

  private audit(context: InvocationContext, operationId: string, outcome: string, targetIds: string[]) {
    this.store.state.audit.push({
      id: newId("aud"),
      at: context.now.toISOString(),
      actor: context.principalId,
      channel: context.channel,
      operationId,
      targetIds: targetIds.filter(Boolean),
      outcome,
      requestId: context.requestId,
      datasetGenerationId: this.store.state.generationId,
    });
  }

  private targetIds(input: unknown): string[] {
    if (!input || typeof input !== "object") return [];
    const record = input as Record<string, unknown>;
    return [record.id, record.productId, record.customerId, record.orderId, record.paymentId]
      .filter((value): value is string => typeof value === "string");
  }

  private issuePreview(
    context: InvocationContext,
    operationId: string,
    input: unknown,
    impactSummary: string,
    blockers: string[],
    expectedRevisions: Record<string, number> = {},
  ) {
    const token = newId("cnf");
    this.store.state.confirmations.set(token, {
      token,
      principalId: context.principalId,
      clientId: context.clientId ?? "unknown",
      operationId,
      payloadHash: canonicalJson(input),
      scopes: context.scopes,
      targetIds: this.targetIds(input),
      expectedRevisions,
      impactSummary,
      input,
      expiresAt: new Date(context.now.getTime() + CONFIRMATION_TTL_MS).toISOString(),
      consumedAt: null,
    });
    return {
      confirmationToken: token,
      operationId,
      expiresAt: this.store.state.confirmations.get(token)!.expiresAt,
      impactSummary,
      blockers,
    };
  }

  private consumeConfirmation(context: InvocationContext, confirmOperationId: string, input: Record<string, unknown>) {
    const token = String(input.confirmationToken ?? context.confirmationToken ?? "");
    const intent = this.store.state.confirmations.get(token);
    if (!intent) fail("CONFIRMATION_REQUIRED", "Confirmation token is missing or unknown");
    if (intent.consumedAt) fail("CONFIRMATION_STALE", "Confirmation token already used");
    if (intent.expiresAt <= context.now.toISOString()) fail("CONFIRMATION_EXPIRED", "Confirmation token expired");
    if (intent.principalId !== context.principalId || intent.clientId !== (context.clientId ?? "unknown")) {
      fail("FORBIDDEN", "Confirmation token is bound to another actor");
    }
    const previewId = confirmOperationId.replace(/^confirm/, "preview");
    if (intent.operationId !== previewId && intent.operationId !== confirmOperationId) {
      fail("CONFIRMATION_STALE", "Confirmation token is bound to another operation");
    }
    intent.consumedAt = context.now.toISOString();
    return intent;
  }

  private dispatch(operationId: string, input: Record<string, unknown>, context: InvocationContext): Promise<unknown> | unknown {
    const migrationBlockerCount = Array.isArray((this.store as MemoryStore & { migrationBlockers?: unknown[] }).migrationBlockers)
      ? (this.store as MemoryStore & { migrationBlockers: unknown[] }).migrationBlockers.length
      : 0;
    switch (operationId) {
      case "getStatus":
        return {
          ok: true,
          contractVersion: "1.0.0",
          authoritativeStore: this.store.authoritativeStore,
          datasetGenerationId: this.store.state.generationId,
          writeFence: this.store.state.writeFence,
          mcpMutationsEnabled: true,
          migrationReady: migrationBlockerCount === 0,
          migrationBlockerCount,
        };
      case "getCapabilities":
        return {
          contractVersion: "1.0.0",
          operations: OPERATIONS.map((operation) => operation.operationId),
          mcpTools: OPERATIONS.map((operation) => operation.tool).filter(Boolean),
          killSwitches: { mcpRead: false, mcpWrite: false, mcpChannel: false },
        };
      case "listPublicProducts":
        return this.pagePublicProducts(input);
      case "getPublicProduct":
        return this.publicProduct(String(input.id ?? input.productId));
      case "listPublicCategories":
        return { items: this.categories(false).map(({ id, label, value }) => ({ id, label, value })) };
      case "getPublicSettings":
        return { phoneNumber: this.store.state.phone.phoneNumber, revision: this.store.state.phone.revision };
      case "listProducts":
        return paginate(this.products(Boolean(input.includeArchived)).map((product) => this.adminProduct(product)), input.limit as number | undefined);
      case "getProduct":
        return this.adminProduct(this.product(String(input.id ?? input.productId)));
      case "createProduct":
        return this.writeProduct(undefined, input, context);
      case "updateProduct":
        return this.writeProduct(String(input.id ?? input.productId), input, context);
      case "archiveProduct":
        return this.setProductArchived(String(input.id ?? input.productId), true, context);
      case "restoreProduct":
        return this.setProductArchived(String(input.id ?? input.productId), false, context);
      case "listCategories":
        return paginate(this.categories(Boolean(input.includeArchived)), input.limit as number | undefined);
      case "createCategory":
        return this.writeCategory(undefined, input, context);
      case "updateCategory":
        return this.writeCategory(String(input.id ?? input.categoryId), input, context);
      case "archiveCategory":
        return this.setCategoryArchived(String(input.id ?? input.categoryId), true, context);
      case "restoreCategory":
        return this.setCategoryArchived(String(input.id ?? input.categoryId), false, context);
      case "listCustomers":
        return paginate(
          this.customers(Boolean(input.includeArchived))
            .filter((customer) => this.matchesQuery(input.q, customer.name, customer.phone, customer.id))
            .map((customer) => maskCustomer(customer, activeCustomers(this.store))),
          input.limit as number | undefined,
        );
      case "getCustomer":
        return customerDetail(this.customer(String(input.id ?? input.customerId)), activeCustomers(this.store));
      case "createCustomer":
        return this.writeCustomer(undefined, input, context);
      case "updateCustomer":
        return this.writeCustomer(String(input.id ?? input.customerId), input, context);
      case "archiveCustomer":
        return this.setCustomerArchived(String(input.id ?? input.customerId), true, context);
      case "restoreCustomer":
        return this.setCustomerArchived(String(input.id ?? input.customerId), false, context);
      case "previewCustomerMerge":
        return this.previewMerge(input, context);
      case "confirmCustomerMerge":
        return this.confirmMerge(input, context);
      case "previewCustomerUnmerge":
        return this.previewUnmerge(input, context);
      case "confirmCustomerUnmerge":
        return this.confirmUnmerge(input, context);
      case "listOrders":
        return paginate(
          this.orders()
            .filter((order) => !input.status || order.status === input.status)
            .filter((order) => this.matchesQuery(input.q, order.contact.name, order.contact.phone, order.id))
            .map((order) => maskOrder(this.store, order)),
          input.limit as number | undefined,
        );
      case "getOrder":
        return maskOrder(this.store, this.order(String(input.id ?? input.orderId)));
      case "getOrderInvoice":
        return orderDetail(this.store, this.order(String(input.id ?? input.orderId)));
      case "createDraftOrder":
        return this.writeDraft(undefined, input, context);
      case "updateDraftOrder":
        return this.writeDraft(String(input.id ?? input.orderId), input, context);
      case "discardDraftOrder":
        return this.discardDraft(String(input.id ?? input.orderId), context);
      case "restoreDraftOrder":
        return this.restoreDraft(String(input.id ?? input.orderId), context);
      case "confirmOrder":
        return this.transition(String(input.id ?? input.orderId), "confirmed", context);
      case "markOrderShipping":
        return this.transition(String(input.id ?? input.orderId), "shipping", context);
      case "completeOrder":
        return this.transition(String(input.id ?? input.orderId), "completed", context);
      case "cloneOrder":
        return this.cloneOrder(String(input.id ?? input.orderId), context);
      case "previewOrderCancellation":
        return this.previewCancel(input, context);
      case "confirmOrderCancellation":
        return this.confirmCancel(input, context);
      case "recordPayment":
        return this.recordPayment(input, context);
      case "listPayments":
        return paginate(
          [...this.store.state.payments.values()]
            .filter((payment) => payment.datasetGenerationId === this.store.state.generationId)
            .filter((payment) => !input.orderId || payment.orderId === input.orderId)
            .map(paymentView),
          input.limit as number | undefined,
        );
      case "listReceivables":
        return paginate(
          this.orders()
            .map((order) => {
              const money = orderMoney(this.store, order);
              return {
                id: order.id,
                createdAt: order.createdAt,
                orderId: order.id,
                customerId: order.customerId,
                orderTotal: money.total,
                netCollected: money.netCollected,
                outstanding: money.outstanding,
              };
            })
            .filter((row) => row.outstanding > 0),
          input.limit as number | undefined,
        );
      case "previewPaymentReversal":
      case "previewPaymentRefund":
        return this.previewPaymentAdjust(operationId, input, context);
      case "confirmPaymentReversal":
        return this.confirmPaymentAdjust("reversal", input, context);
      case "confirmPaymentRefund":
        return this.confirmPaymentAdjust("refund", input, context);
      case "listCashTransactions":
        return paginate(
          [...this.store.state.cash.values()].filter((row) => row.datasetGenerationId === this.store.state.generationId),
          input.limit as number | undefined,
        );
      case "createCashTransaction":
        return this.createCash(input, context);
      case "previewCashReversal":
        return this.previewCash(input, context);
      case "confirmCashReversal":
        return this.confirmCash(input, context);
      case "getReportSummary":
        return this.report(input);
      case "getConfirmedSalesReport":
        return this.moneyReport(input, "confirmedSales");
      case "getReceiptsReport": {
        const summary = this.report(input);
        return {
          grossReceipts: summary.grossReceipts,
          refunds: summary.refunds,
          netReceipts: summary.netReceipts,
          fromDate: summary.fromDate,
          toDate: summary.toDate,
          timezone: summary.timezone,
        };
      }
      case "getReceivablesReport":
        return this.moneyReport(input, "receivables");
      case "getDiscountsShippingReport": {
        const summary = this.report(input);
        return {
          discounts: summary.discounts,
          shippingFees: summary.shippingFees,
          fromDate: summary.fromDate,
          toDate: summary.toDate,
          timezone: summary.timezone,
        };
      }
      case "getCogsProfitReport": {
        const summary = this.report(input);
        return {
          confirmedSales: summary.confirmedSales,
          cogs: summary.cogs,
          profit: summary.profit,
          fromDate: summary.fromDate,
          toDate: summary.toDate,
          timezone: summary.timezone,
        };
      }
      case "getPhoneSettings":
        return this.store.state.phone;
      case "updatePhoneSettings":
        this.store.requireWritable();
        this.store.bump(this.store.state.phone, context.expectedRevision);
        this.store.state.phone.phoneNumber = String(input.phoneNumber);
        return this.store.state.phone;
      case "getShopSettings":
        return this.store.state.shop;
      case "updateShopSettings":
        this.store.requireWritable();
        this.store.bump(this.store.state.shop, context.expectedRevision);
        if (input.name) this.store.state.shop.name = String(input.name);
        if (input.address) this.store.state.shop.address = String(input.address);
        return this.store.state.shop;
      case "getBankSettings":
        return this.store.state.bank;
      case "updateBankSettings":
        this.store.requireWritable();
        this.store.bump(this.store.state.bank, context.expectedRevision);
        this.store.state.bank = {
          ...this.store.state.bank,
          bankName: String(input.bankName),
          accountNumber: String(input.accountNumber),
          accountName: String(input.accountName),
          qrCodeUrl: String(input.qrCodeUrl ?? ""),
        };
        return this.store.state.bank;
      case "getTaxSettings":
        return this.store.state.tax;
      case "updateTaxSettings":
        this.store.requireWritable();
        this.store.bump(this.store.state.tax, context.expectedRevision);
        this.store.state.tax.rate = Number(input.rate);
        return this.store.state.tax;
      case "listShopTemplates":
        return paginate(
          [...this.store.state.templates.values()].filter((row) => row.datasetGenerationId === this.store.state.generationId),
          input.limit as number | undefined,
        );
      case "createShopTemplate":
        return this.writeTemplate(undefined, input, context);
      case "updateShopTemplate":
        return this.writeTemplate(String(input.id ?? input.templateId), input, context);
      case "archiveShopTemplate":
        return this.setTemplateArchived(String(input.id ?? input.templateId), true, context);
      case "restoreShopTemplate":
        return this.setTemplateArchived(String(input.id ?? input.templateId), false, context);
      case "setDefaultShopTemplate":
        return this.setDefaultTemplate(String(input.id ?? input.templateId), context);
      case "previewBackupExport":
        return this.issuePreview(context, "previewBackupExport", input, "Create a PII-bearing business backup artifact.", []);
      case "confirmBackupExport":
        return this.exportBackup(input, context);
      case "getBackupManifest":
        return this.manifest(String(input.id ?? input.backupId));
      case "createBackupDownloadGrant":
        return this.grant(String(input.id ?? input.backupId), "download", context);
      case "createBackupUploadIntent":
        return this.grant(newId("bak"), "upload", context);
      case "finalizeBackupUpload":
        return this.finalizeUpload(String(input.uploadId), context);
      case "previewRestore":
        return this.issuePreview(context, "previewRestore", input, "Stage an inactive dataset generation and switch after confirmation.", []);
      case "confirmRestore":
        return this.confirmRestore(input, context);
      case "searchAuditEvents":
        return paginate(
          this.store.state.audit
            .filter((event) => !input.operationId || event.operationId === input.operationId)
            .map((event) => ({ ...event, createdAt: event.at })),
          input.limit as number | undefined,
        );
      default:
        fail("NOT_FOUND", `Unknown operation ${operationId}`);
    }
  }

  private matchesQuery(query: unknown, ...fields: string[]) {
    if (!query) return true;
    const needle = String(query).toLowerCase();
    return fields.some((field) => field.toLowerCase().includes(needle));
  }

  private products(includeArchived: boolean) {
    return activeProducts(this.store)
      .filter((product) => includeArchived || !product.archived)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
  }

  private product(id: string) {
    const product = this.store.state.products.get(id);
    if (!product || product.datasetGenerationId !== this.store.state.generationId) fail("NOT_FOUND", "Product not found");
    return product;
  }

  private adminProduct(product: ProductRecord) {
    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      description: product.description,
      image: product.image,
      isHot: product.isHot,
      variants: product.variants,
      archived: product.archived,
      revision: product.revision,
      createdAt: product.createdAt,
    };
  }

  private pagePublicProducts(input: Record<string, unknown>) {
    const items = this.products(false).map((product) => publicProductFromAdmin(product));
    items.forEach(assertPublicProjection);
    return paginate(items.map((item, index) => ({ ...item, createdAt: this.products(false)[index].createdAt })), input.limit as number | undefined);
  }

  private publicProduct(id: string) {
    const projection = publicProductFromAdmin(this.product(id));
    assertPublicProjection(projection);
    return projection;
  }

  private writeProduct(id: string | undefined, input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const variants = (input.variants as ProductRecord["variants"]) ?? [];
    variants.forEach(assertVariant);
    const now = context.now.toISOString();
    if (!id) {
      const product: ProductRecord = {
        id: newId("prd"),
        name: String(input.name),
        categoryId: String(input.categoryId),
        description: String(input.description ?? ""),
        image: String(input.image ?? ""),
        isHot: Boolean(input.isHot),
        variants,
        archived: false,
        revision: 1,
        datasetGenerationId: this.store.state.generationId,
        createdAt: now,
        updatedAt: now,
      };
      this.store.state.products.set(product.id, product);
      return this.adminProduct(product);
    }
    const product = this.product(id);
    this.store.bump(product, context.expectedRevision);
    product.name = String(input.name ?? product.name);
    product.categoryId = String(input.categoryId ?? product.categoryId);
    product.description = String(input.description ?? product.description);
    product.image = String(input.image ?? product.image);
    product.isHot = input.isHot === undefined ? product.isHot : Boolean(input.isHot);
    product.variants = variants.length ? variants : product.variants;
    product.updatedAt = now;
    return this.adminProduct(product);
  }

  private setProductArchived(id: string, archived: boolean, context: InvocationContext) {
    this.store.requireWritable();
    const product = this.product(id);
    this.store.bump(product, context.expectedRevision);
    product.archived = archived;
    return this.adminProduct(product);
  }

  private categories(includeArchived: boolean) {
    return [...this.store.state.categories.values()]
      .filter((category) => category.datasetGenerationId === this.store.state.generationId)
      .filter((category) => includeArchived || !category.archived);
  }

  private category(id: string) {
    const category = this.store.state.categories.get(id);
    if (!category || category.datasetGenerationId !== this.store.state.generationId) fail("NOT_FOUND", "Category not found");
    return category;
  }

  private writeCategory(id: string | undefined, input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const now = context.now.toISOString();
    const label = String(input.label ?? "");
    if (!label.trim()) fail("VALIDATION_ERROR", "Category label is required");
    const value = String(input.value ?? label.toUpperCase().replace(/\s+/g, "_"));
    if (!id) {
      const category = {
        id: newId("cat"),
        label,
        value,
        archived: false,
        revision: 1,
        datasetGenerationId: this.store.state.generationId,
        createdAt: now,
        updatedAt: now,
      };
      this.store.state.categories.set(category.id, category);
      return category;
    }
    const category = this.category(id);
    this.store.bump(category, context.expectedRevision);
    category.label = label || category.label;
    category.value = String(input.value ?? category.value);
    category.updatedAt = now;
    return category;
  }

  private setCategoryArchived(id: string, archived: boolean, context: InvocationContext) {
    this.store.requireWritable();
    const category = this.category(id);
    this.store.bump(category, context.expectedRevision);
    category.archived = archived;
    return category;
  }

  private customers(includeArchived: boolean) {
    return activeCustomers(this.store).filter((customer) => includeArchived || !customer.archived);
  }

  private customer(id: string) {
    const customer = this.store.state.customers.get(id);
    if (!customer || customer.datasetGenerationId !== this.store.state.generationId) fail("NOT_FOUND", "Customer not found");
    return customer;
  }

  private writeCustomer(id: string | undefined, input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const body = { name: String(input.name ?? ""), phone: String(input.phone ?? ""), address: String(input.address ?? "") };
    assertCustomerWrite(body);
    const now = context.now.toISOString();
    if (!id) {
      const customer: CustomerRecord = {
        id: newId("cus"),
        ...body,
        archived: false,
        revision: 1,
        mergedIntoId: null,
        datasetGenerationId: this.store.state.generationId,
        createdAt: now,
        updatedAt: now,
      };
      this.store.state.customers.set(customer.id, customer);
      return customerDetail(customer, activeCustomers(this.store));
    }
    const customer = this.customer(id);
    this.store.bump(customer, context.expectedRevision);
    customer.name = body.name;
    customer.phone = body.phone;
    customer.address = body.address;
    customer.updatedAt = now;
    return customerDetail(customer, activeCustomers(this.store));
  }

  private setCustomerArchived(id: string, archived: boolean, context: InvocationContext) {
    this.store.requireWritable();
    const customer = this.customer(id);
    this.store.bump(customer, context.expectedRevision);
    customer.archived = archived;
    return customerDetail(customer, activeCustomers(this.store));
  }

  private previewMerge(input: Record<string, unknown>, context: InvocationContext) {
    const canonical = this.customer(String(input.canonicalCustomerId));
    const source = this.customer(String(input.sourceCustomerId));
    if (canonical.id === source.id) fail("VALIDATION_ERROR", "Cannot merge a customer into itself");
    return this.issuePreview(
      context,
      "previewCustomerMerge",
      input,
      `Merge ${source.id} into ${canonical.id} and remap orders.`,
      [],
      { [canonical.id]: canonical.revision, [source.id]: source.revision },
    );
  }

  private confirmMerge(input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const intent = this.consumeConfirmation(context, "confirmCustomerMerge", input);
    const body = intent.input as Record<string, unknown>;
    const canonical = this.customer(String(body.canonicalCustomerId));
    const source = this.customer(String(body.sourceCustomerId));
    this.store.bump(canonical, intent.expectedRevisions[canonical.id]);
    this.store.bump(source, intent.expectedRevisions[source.id]);
    source.mergedIntoId = canonical.id;
    source.archived = true;
    for (const order of this.orders()) {
      if (order.customerId === source.id) order.customerId = canonical.id;
    }
    const event = {
      id: newId("mrg"),
      canonicalCustomerId: canonical.id,
      sourceCustomerId: source.id,
      reversed: false,
      datasetGenerationId: this.store.state.generationId,
      createdAt: context.now.toISOString(),
    };
    this.store.state.mergeEvents.set(event.id, event);
    return customerDetail(canonical, activeCustomers(this.store));
  }

  private previewUnmerge(input: Record<string, unknown>, context: InvocationContext) {
    const event = this.store.state.mergeEvents.get(String(input.mergeEventId));
    if (!event || event.reversed) fail("NOT_FOUND", "Merge event not found");
    return this.issuePreview(context, "previewCustomerUnmerge", input, `Unmerge ${event.sourceCustomerId} using recorded lineage.`, []);
  }

  private confirmUnmerge(input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const intent = this.consumeConfirmation(context, "confirmCustomerUnmerge", input);
    const body = intent.input as Record<string, unknown>;
    const event = this.store.state.mergeEvents.get(String(body.mergeEventId));
    if (!event || event.reversed) fail("NOT_FOUND", "Merge event not found");
    event.reversed = true;
    const source = this.customer(event.sourceCustomerId);
    source.mergedIntoId = null;
    source.archived = false;
    return customerDetail(source, activeCustomers(this.store));
  }

  private orders() {
    return activeOrders(this.store).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private order(id: string) {
    const order = this.store.state.orders.get(id);
    if (!order || order.datasetGenerationId !== this.store.state.generationId) fail("NOT_FOUND", "Order not found");
    return order;
  }

  private writeDraft(id: string | undefined, input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const customer = this.customer(String(input.customerId));
    const items = (input.items as OrderRecord["items"]) ?? [];
    computeOrderTotals(items.map((item) => ({
      quantity: item.quantity,
      soCuon: item.soCuon,
      soKi: item.soKi,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
    })), Number(input.discount ?? 0), Number(input.shippingFee ?? 0));
    const contact = (input.contactSnapshot as OrderRecord["contact"]) ?? {
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
    };
    const now = context.now.toISOString();
    if (!id) {
      const order: OrderRecord = {
        id: newId("ord"),
        customerId: customer.id,
        contact,
        items: items.map((item) => ({ ...item, id: item.id || newId("lin") })),
        status: "draft",
        discount: Number(input.discount ?? 0),
        shippingFee: Number(input.shippingFee ?? 0),
        note: String(input.note ?? ""),
        shopTemplateId: input.shopTemplateId ? String(input.shopTemplateId) : null,
        sellerSnapshot: this.sellerSnapshot(),
        paymentMethod: (input.paymentMethod as "cod" | "banking") ?? "cod",
        revision: 1,
        discarded: false,
        cancelReason: null,
        datasetGenerationId: this.store.state.generationId,
        createdAt: now,
        updatedAt: now,
      };
      this.store.state.orders.set(order.id, order);
      return orderDetail(this.store, order);
    }
    const order = this.order(id);
    assertDraftEditable(order.status);
    this.store.bump(order, context.expectedRevision);
    order.customerId = customer.id;
    order.contact = contact;
    order.items = items.map((item) => ({ ...item, id: item.id || newId("lin") }));
    order.discount = Number(input.discount ?? order.discount);
    order.shippingFee = Number(input.shippingFee ?? order.shippingFee);
    order.note = String(input.note ?? order.note);
    order.updatedAt = now;
    return orderDetail(this.store, order);
  }

  private sellerSnapshot() {
    const template = [...this.store.state.templates.values()].find((row) => row.isDefault) ?? [...this.store.state.templates.values()][0];
    return template ? { id: template.id, name: template.name, address: template.address, phone: template.phone } : this.store.state.shop;
  }

  private discardDraft(id: string, context: InvocationContext) {
    this.store.requireWritable();
    const order = this.order(id);
    const money = orderMoney(this.store, order);
    assertCanDiscardDraft(order.status, money.netCollected);
    this.store.bump(order, context.expectedRevision);
    order.status = transitionOrder(order.status, "discarded");
    order.discarded = true;
    return orderDetail(this.store, order);
  }

  private restoreDraft(id: string, context: InvocationContext) {
    this.store.requireWritable();
    const order = this.order(id);
    this.store.bump(order, context.expectedRevision);
    order.status = transitionOrder(order.status, "draft");
    order.discarded = false;
    return orderDetail(this.store, order);
  }

  private transition(id: string, to: OrderRecord["status"], context: InvocationContext) {
    this.store.requireWritable();
    const order = this.order(id);
    this.store.bump(order, context.expectedRevision);
    order.status = transitionOrder(order.status, to);
    order.updatedAt = context.now.toISOString();
    if (to === "confirmed") order.sellerSnapshot = this.sellerSnapshot();
    return orderDetail(this.store, order);
  }

  private cloneOrder(id: string, context: InvocationContext) {
    const order = this.order(id);
    return this.writeDraft(undefined, {
      customerId: order.customerId,
      contactSnapshot: order.contact,
      items: order.items,
      discount: order.discount,
      shippingFee: order.shippingFee,
      note: order.note,
      shopTemplateId: order.shopTemplateId,
      paymentMethod: order.paymentMethod,
    }, context);
  }

  private previewCancel(input: Record<string, unknown>, context: InvocationContext) {
    const order = this.order(String(input.id ?? input.orderId));
    const money = orderMoney(this.store, order);
    const blockers = money.netCollected === 0 ? [] : [`netCollected=${money.netCollected}; record refund or reversal first`];
    try {
      assertCanCancel(order.status, money.netCollected, String(input.reason ?? ""));
    } catch (error) {
      if (error instanceof DomainError && error.code === "INVALID_TRANSITION" && money.netCollected !== 0) {
        return this.issuePreview(context, "previewOrderCancellation", input, "Cancellation blocked by collected payment.", blockers, { [order.id]: order.revision });
      }
      throw error;
    }
    return this.issuePreview(context, "previewOrderCancellation", input, `Cancel order ${order.id}.`, blockers, { [order.id]: order.revision });
  }

  private confirmCancel(input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const intent = this.consumeConfirmation(context, "confirmOrderCancellation", input);
    const body = intent.input as Record<string, unknown>;
    const order = this.order(String(body.id ?? body.orderId));
    const money = orderMoney(this.store, order);
    assertCanCancel(order.status, money.netCollected, String(body.reason ?? ""));
    this.store.bump(order, intent.expectedRevisions[order.id]);
    order.status = transitionOrder(order.status, "cancelled");
    order.cancelReason = String(body.reason);
    return orderDetail(this.store, order);
  }

  private recordPayment(input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const order = this.order(String(input.orderId));
    const money = orderMoney(this.store, order);
    assertPaymentAllowed(money.total, money.netCollected, Number(input.amount), order.status);
    const payment: PaymentRecord = {
      id: newId("pay"),
      orderId: order.id,
      amount: Number(input.amount),
      reversedAmount: 0,
      refundedAmount: 0,
      method: String(input.method ?? "cash"),
      note: String(input.note ?? ""),
      datasetGenerationId: this.store.state.generationId,
      createdAt: context.now.toISOString(),
    };
    this.store.state.payments.set(payment.id, payment);
    return paymentView(payment);
  }

  private previewPaymentAdjust(operationId: string, input: Record<string, unknown>, context: InvocationContext) {
    const payment = this.store.state.payments.get(String(input.id ?? input.paymentId));
    if (!payment) fail("NOT_FOUND", "Payment not found");
    remainingConsumable(payment);
    return this.issuePreview(context, operationId, input, `${operationId} ${payment.id}`, [], {});
  }

  private confirmPaymentAdjust(kind: "reversal" | "refund", input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const intent = this.consumeConfirmation(context, kind === "reversal" ? "confirmPaymentReversal" : "confirmPaymentRefund", input);
    const body = intent.input as Record<string, unknown>;
    const payment = this.store.state.payments.get(String(body.id ?? body.paymentId));
    if (!payment) fail("NOT_FOUND", "Payment not found");
    const next = applyConsumption(payment, kind, Number(body.amount));
    payment.reversedAmount = next.reversedAmount;
    payment.refundedAmount = next.refundedAmount;
    return paymentView(payment);
  }

  private createCash(input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const row = {
      id: newId("csh"),
      type: input.type === "expense" ? "expense" as const : "income" as const,
      amount: Number(input.amount),
      reversedAmount: 0,
      description: String(input.description ?? ""),
      category: String(input.category ?? ""),
      date: String(input.date ?? context.now.toISOString().slice(0, 10)),
      datasetGenerationId: this.store.state.generationId,
      createdAt: context.now.toISOString(),
    };
    this.store.state.cash.set(row.id, row);
    return row;
  }

  private previewCash(input: Record<string, unknown>, context: InvocationContext) {
    const row = this.store.state.cash.get(String(input.id ?? input.transactionId));
    if (!row) fail("NOT_FOUND", "Cash transaction not found");
    return this.issuePreview(context, "previewCashReversal", input, `Reverse cash ${row.id}`, []);
  }

  private confirmCash(input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const intent = this.consumeConfirmation(context, "confirmCashReversal", input);
    const body = intent.input as Record<string, unknown>;
    const row = this.store.state.cash.get(String(body.id ?? body.transactionId));
    if (!row) fail("NOT_FOUND", "Cash transaction not found");
    row.reversedAmount = row.amount;
    return row;
  }

  private report(input: Record<string, unknown>) {
    const fromDate = String(input.fromDate ?? "1970-01-01");
    const toDate = String(input.toDate ?? "9999-12-31");
    const orders = this.orders()
      .filter((order) => inBusinessRange(order.createdAt, fromDate, toDate))
      .map((order) => ({
        status: order.status,
        discount: order.discount,
        shippingFee: order.shippingFee,
        lines: order.items,
        payments: paymentsFor(this.store, order.id),
      }));
    return { ...summarizeOrders(orders), fromDate, toDate, timezone: BUSINESS_TIMEZONE };
  }

  private moneyReport(input: Record<string, unknown>, field: "confirmedSales" | "receivables") {
    const summary = this.report(input);
    return { amount: summary[field], fromDate: summary.fromDate, toDate: summary.toDate, timezone: summary.timezone };
  }

  private writeTemplate(id: string | undefined, input: Record<string, unknown>, context: InvocationContext) {
    this.store.requireWritable();
    const now = context.now.toISOString();
    if (!id) {
      const template = {
        id: newId("tpl"),
        name: String(input.name),
        address: String(input.address ?? ""),
        phone: String(input.phone ?? ""),
        isDefault: Boolean(input.isDefault) || this.store.state.templates.size === 0,
        archived: false,
        revision: 1,
        datasetGenerationId: this.store.state.generationId,
        createdAt: now,
        updatedAt: now,
      };
      if (template.isDefault) {
        for (const row of this.store.state.templates.values()) row.isDefault = false;
      }
      this.store.state.templates.set(template.id, template);
      return template;
    }
    const template = this.store.state.templates.get(id);
    if (!template) fail("NOT_FOUND", "Template not found");
    this.store.bump(template, context.expectedRevision);
    template.name = String(input.name ?? template.name);
    template.address = String(input.address ?? template.address);
    template.phone = String(input.phone ?? template.phone);
    return template;
  }

  private setTemplateArchived(id: string, archived: boolean, context: InvocationContext) {
    const template = this.store.state.templates.get(id);
    if (!template) fail("NOT_FOUND", "Template not found");
    this.store.bump(template, context.expectedRevision);
    template.archived = archived;
    if (archived) template.isDefault = false;
    return template;
  }

  private setDefaultTemplate(id: string, context: InvocationContext) {
    const template = this.store.state.templates.get(id);
    if (!template || template.archived) fail("NOT_FOUND", "Template not found");
    this.store.bump(template, context.expectedRevision);
    for (const row of this.store.state.templates.values()) row.isDefault = row.id === id;
    return template;
  }

  private async exportBackup(_input: Record<string, unknown>, context: InvocationContext) {
    this.consumeConfirmation(context, "confirmBackupExport", _input);
    const payloadObject = {
      schemaVersion: "1.0.0",
      products: [...this.store.state.products.values()],
      categories: [...this.store.state.categories.values()],
      customers: [...this.store.state.customers.values()],
      orders: [...this.store.state.orders.values()],
      payments: [...this.store.state.payments.values()],
      cash: [...this.store.state.cash.values()],
      templates: [...this.store.state.templates.values()],
      settings: {
        phone: this.store.state.phone,
        shop: this.store.state.shop,
        bank: this.store.state.bank,
        tax: this.store.state.tax,
      },
    };
    const payload = JSON.stringify(payloadObject);
    const backup = {
      id: newId("bak"),
      status: "ready",
      schemaVersion: "1.0.0",
      createdAt: context.now.toISOString(),
      byteLength: payload.length,
      checksumSha256: await sha256Hex(payload),
      payload,
      sectionCounts: {
        products: payloadObject.products.length,
        customers: payloadObject.customers.length,
        orders: payloadObject.orders.length,
      },
    };
    this.store.state.backups.set(backup.id, backup);
    const { payload: _payload, ...manifest } = backup;
    return manifest;
  }

  private manifest(id: string) {
    const backup = this.store.state.backups.get(id);
    if (!backup) fail("NOT_FOUND", "Backup not found");
    const { payload: _payload, ...manifest } = backup;
    return manifest;
  }

  private grant(artifactId: string, direction: "upload" | "download", context: InvocationContext) {
    if (direction === "download" && !this.store.state.backups.has(artifactId)) fail("NOT_FOUND", "Backup not found");
    const grant = {
      grantId: newId("grt"),
      artifactId,
      direction,
      expiresAt: new Date(context.now.getTime() + 10 * 60 * 1000).toISOString(),
      used: false,
    };
    this.store.state.grants.set(grant.grantId, grant);
    return { ...grant, path: `/api/v1/artifacts/${grant.grantId}` };
  }

  private finalizeUpload(uploadId: string, context: InvocationContext) {
    const grant = this.store.state.grants.get(uploadId);
    if (!grant || grant.direction !== "upload") fail("NOT_FOUND", "Upload grant not found");
    if (grant.expiresAt <= context.now.toISOString()) fail("CONFIRMATION_EXPIRED", "Upload grant expired");
    grant.used = true;
    const backup = {
      id: grant.artifactId,
      status: "approved",
      schemaVersion: "1.0.0",
      createdAt: context.now.toISOString(),
      byteLength: 0,
      checksumSha256: "",
      payload: "{}",
      sectionCounts: {},
    };
    this.store.state.backups.set(backup.id, backup);
    const { payload: _payload, ...manifest } = backup;
    return manifest;
  }

  private confirmRestore(input: Record<string, unknown>, context: InvocationContext) {
    const intent = this.consumeConfirmation(context, "confirmRestore", input);
    const artifactId = String((intent.input as Record<string, unknown>).artifactId ?? input.artifactId ?? "");
    const backup = this.store.state.backups.get(artifactId);
    if (!backup || (backup.status !== "approved" && backup.status !== "ready")) fail("VALIDATION_ERROR", "Artifact is not approved");
    const previous = cloneState(this.store.state);
    const nextGeneration = newId("gen");
    this.store.state.writeFence = true;
    try {
      this.applyBackupPayload(JSON.parse(backup.payload || "{}") as Record<string, unknown>, nextGeneration);
      this.store.state.inactiveGenerations.set(previous.generationId, previous);
      this.store.state.generationId = nextGeneration;
      this.store.state.writeFence = false;
    } catch (error) {
      this.store.state = previous;
      throw error;
    }
    return {
      datasetGenerationId: nextGeneration,
      previousDatasetGenerationId: previous.generationId,
      active: true,
    };
  }

  private applyBackupPayload(payload: Record<string, unknown>, generationId: string) {
    const load = <T extends { id: string }>(items: unknown, map: Map<string, T>) => {
      map.clear();
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!item || typeof item !== "object" || !("id" in item)) continue;
        const record = { ...(item as T), datasetGenerationId: generationId };
        map.set(record.id, record);
      }
    };
    load(payload.products, this.store.state.products);
    load(payload.categories, this.store.state.categories);
    load(payload.customers, this.store.state.customers);
    load(payload.orders, this.store.state.orders);
    load(payload.payments, this.store.state.payments);
    load(payload.cash, this.store.state.cash);
    load(payload.templates, this.store.state.templates);
    const settings = (payload.settings ?? {}) as Record<string, Record<string, unknown>>;
    if (settings.phone) this.store.state.phone = { phoneNumber: String(settings.phone.phoneNumber ?? ""), revision: Number(settings.phone.revision ?? 1) };
    if (settings.shop) this.store.state.shop = { name: String(settings.shop.name ?? ""), address: String(settings.shop.address ?? ""), revision: Number(settings.shop.revision ?? 1) };
    if (settings.bank) {
      this.store.state.bank = {
        bankName: String(settings.bank.bankName ?? ""),
        accountNumber: String(settings.bank.accountNumber ?? ""),
        accountName: String(settings.bank.accountName ?? ""),
        qrCodeUrl: String(settings.bank.qrCodeUrl ?? ""),
        revision: Number(settings.bank.revision ?? 1),
      };
    }
    if (settings.tax) this.store.state.tax = { rate: Number(settings.tax.rate ?? 0), revision: Number(settings.tax.revision ?? 1) };
  }
}

export const ownerContext = (overrides: Partial<InvocationContext> = {}): InvocationContext => ({
  principalId: "principal_owner",
  githubUserId: "1",
  scopes: [...ALL_SCOPES],
  channel: "rpc",
  requestId: newId("req"),
  now: new Date("2026-09-04T00:00:00.000Z"),
  ...overrides,
});

export const legacyAdminContext = (overrides: Partial<InvocationContext> = {}): InvocationContext => ({
  principalId: "principal_legacy_admin",
  githubUserId: "legacy",
  scopes: [
    "catalog:read", "catalog:write",
    "customers:read", "customers:pii:read", "customers:write",
    "orders:read", "orders:write", "orders:lifecycle", "orders:cancel",
    "payments:read", "payments:write", "payments:refund",
    "transactions:read", "transactions:write", "transactions:reverse",
    "reports:read",
    "settings:read", "settings:write",
  ],
  channel: "legacy",
  requestId: newId("req"),
  now: new Date("2026-09-04T00:00:00.000Z"),
  legacy: true,
  ...overrides,
});

export const publicContext = (overrides: Partial<InvocationContext> = {}): InvocationContext => ({
  principalId: "anonymous",
  githubUserId: "0",
  scopes: [],
  channel: "rest",
  requestId: newId("req"),
  now: new Date("2026-09-04T00:00:00.000Z"),
  ...overrides,
});
