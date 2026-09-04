<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"c36b7ae9-9968-44b2-b2cd-3de43e279947","templateVersion":1} -->

# Execution Plan: Giaban MCP and domain platform modernization

Date: 2026-09-03

## Status

Active

## Current Owner Direction (supersedes the original OAuth/D1 topology)

- Owner-private Pi MCP uses `KSHT_API_KEY`; GitHub OAuth is cancelled and must not be required or exposed by the personal MCP.
- The business outcome is Pi replacing manual web-admin work: catalog add/edit/archive, orders, customers, payments/debt, reports, and settings/templates.
- Existing live shop data is already in Cloudflare KV. Local/sample data is historical Google AI Studio residue and is not authoritative.
- Customers only consume public storefront prices/catalog. MCP must mutate the same live Cloudflare shop dataset and publish storefront-compatible public documents; a permanently isolated Durable Object shop copy is not acceptable.
- `GiabanShop` is a single-owner coordinator, recovery journal, and strongly consistent mirror of the last fully published commit. The live adapter hydrates legacy KV, preserves explicit stable IDs, stores versioned canonical state privately, and projects changed legacy documents back to KV with public cost redaction. Ambiguous/malformed/duplicate IDs and debt/totals block affected writes instead of being guessed.
- The user delegated technical choices but not Cloudflare deployment. This slice may change source/config/tests; deploying `ksht-mcp`, initializing canonical live state, Pages publication, `DOMAIN_AUTHORITATIVE=1`, D1 cutover, push, and unrelated live changes remain out of scope until separately named.
- Do not use legacy web-admin writes concurrently with MCP. Workers KV is eventually consistent, has no cross-Worker CAS/transaction, and limits each key to one write per second; the MCP coordinator throttles and journals its own writes but cannot serialize the legacy Worker.
- Older sections below describing GitHub OAuth, a two-Worker Service Binding, or D1 as the selected personal-MCP path are retained as historical design context only and are not current implementation authority.

## Outcome

Giaban has one typed, audited domain/application platform used by an owner-private remote MCP server; Pi authenticates with `KSHT_API_KEY` and performs the same live-shop business work previously done through web admin, using the existing Cloudflare KV dataset while the customer storefront continues to read its public catalog documents. Live binding deployment and first hydration remain separately authorized, evidence-gated operations.

## Authority And Context

- The user explicitly requested an architecture specification and execution plan for later implementation by Grok 4.6 at xhigh reasoning.
- The user confirmed MCP coverage for all existing Giaban business capabilities, while Cloudflare infrastructure operations, deployments, secrets, bindings, and resource administration are excluded from the MCP surface.
- The user confirmed owner-only initial use, GitHub OAuth, future role/scope extensibility, and Pi as the first acceptance client without architectural coupling to Pi.
- The user confirmed cloud as the sole business source of truth; browser localStorage may cache reads and retain the shopper cart but must not silently become an alternate admin write source.
- The user confirmed server-enforced preview then confirmation for destructive, bulk, cancellation, restore, and financial-adjustment operations; ordinary valid writes require idempotency, revisions, and audit.
- The user confirmed stable customerId identity, phone as search/duplicate-warning data rather than identity, order-time contact snapshots, audited reversible customer merges, an explicit order lifecycle, an independent payment ledger, derived receivables, immutable financial history with reversals, and backend-owned reporting formulas.
- The user confirmed PII masking by default, explicit customers:pii:read access for detailed PII, pagination/filtering instead of unbounded dumps, and auditing of sensitive reads.
- The user confirmed a staged KV-to-D1 migration with backup, staging rehearsal, deterministic-only normalization, manual exception review, reconciliation, a short production write freeze, compatibility rollback, and no silent repair of ambiguous records.
- Repository evidence: cloudflare_worker.js exposes coarse GET/POST /api/data/:key routes; workerContract.js lists three public and seven private whole-document KV keys; apiService.ts falls back to localStorage; businessService.ts performs whole-array read/modify/write; hooks/useBusinessData.ts and business UI components contain domain and financial logic; tests/cloudflare-worker.test.js currently cover the Worker security contract.
- Official primary-source guidance was checked on 2026-09-03 for MCP Streamable HTTP/authorization and Cloudflare remote MCP/stateless handler direction; implementation sessions must refresh current docs and pinned SDK APIs before coding.
- docs/plans/active/secure-worker-clean-ai-studio.md has Status Completed and is not authority for this work. Current Git evidence before plan creation showed master at 0bc4f48, ahead of origin/master by one commit, with no working-tree diff.

## Scope

In scope:

- Create one repository-owned domain/application seam used by independently evolving HTTP/frontend and MCP consumers, with one authoritative machine-checkable boundary contract.
- Model and validate products/variants, categories, customers, orders/order lines, payments, cash transactions, cost snapshots, bank/tax settings, shop templates, audit events, idempotency records, confirmation intents, and migration metadata.
- Model payment refunds needed for financially correct cancellation, logical business-dataset generations for atomic restore, and private backup-artifact manifests/grants; MCP records business facts but never initiates an external bank transfer.
- Implement resource- and workflow-level business operations for catalog, customers, orders, payments/receivables, transactions, reports, settings/templates, and controlled backup/restore.
- Adopt D1 as the authoritative business store with repository-owned migrations; retain KV only for explicitly public read projections/cache and isolated OAuth-provider state.
- Provide a stateless Streamable HTTP MCP endpoint with GitHub-backed OAuth identity, server-enforced scopes, PII minimization, pagination, structured outputs, actionable errors, and precise tool annotations.
- Migrate the React frontend from browser-owned business logic and implicit local writes to the same backend contract while preserving shopper-facing catalog availability and local cart behavior.
- Provide a compatibility lane for the deployed frontend during expand/contract migration, then remove raw whole-key business writes after all consumers and rollback gates are proven.
- Rehearse legacy KV export/transform/import/reconciliation without reading or exposing unnecessary live customer data; preserve an immutable rollback snapshot and route ambiguous records to review.
- Add domain, contract, Worker/API, MCP, authorization, concurrency, idempotency, migration, reconciliation, and end-to-end acceptance tests.
- Document operational cutover, monitoring, rollback, and recovery gates inside this authoritative plan as implementation evidence becomes available.

Out of scope:

- MCP tools that deploy or administer Cloudflare Workers, Pages, D1, KV, OAuth secrets, bindings, routes, accounts, domains, or GitHub infrastructure.
- Public or customer-facing MCP access in the initial outcome.
- New inventory, supplier, purchasing, employee-management, marketing, or multi-store product domains.
- Hard deletion of referenced or financial business records through the normal application or MCP surface.
- Treating MCP annotations, CORS, browser confirmation dialogs, client identity, or localStorage state as authorization.
- Unbounded full-data dumps through ordinary list/search tools.
- Production provisioning, OAuth application creation, secret changes, deployment, publication, push, or live data migration without a later explicit request authorizing that exact target and action.
- Unrelated frontend redesign, framework migration, dependency modernization, or cleanup.

## Constraints

- Preserve unrelated commits, worktree changes, and untracked files; do not push, publish, deploy, rewrite history, or mutate live Cloudflare/GitHub resources without exact follow-up authority.
- Repository AGENTS.md remains authoritative: sessions, credentials, CORS, customer/order data, Worker bindings, and storage are security-sensitive; never expose secrets or live business data.
- Use TypeScript and Cloudflare-compatible APIs; retrieve current official MCP and Cloudflare documentation before selecting SDK signatures, bindings, compatibility flags, or authorization metadata.
- The application/domain interface is the preferred test seam. REST and MCP are adapters and must not duplicate pricing, debt, lifecycle, identity, or authorization policy.
- Use one authoritative, repository-owned machine-checkable contract for independently evolving consumers. Validate actual serialized provider responses, not only TypeScript types.
- Cloud is authoritative for business data. Admin writes fail closed when cloud persistence fails; local caches include freshness/revision semantics and never report unpersisted success.
- Orders have stable IDs and customerId references plus sale-time contact snapshots. Phone numbers support lookup and duplicate warnings but are not identity keys.
- Order lifecycle is draft to confirmed to shipping to completed, with cancellation from approved nonterminal states, required cancellation reason, and no reopening of cancelled orders; payment state is independent.
- Order total excludes previous debt. Payments support partial collection; outstanding balance is derived. Financial records are immutable and corrected with reversal/adjustment entries.
- Line items snapshot sale price and cost inputs. Reports separately expose confirmed sales, gross cash receipts, refunds, net cash receipts, receivables, discounts, shipping fees, cost of goods, and backend-calculated profit.
- Public catalog and cache schemas must never contain cost price, COGS, margin, private bank data, or another admin-only field. Define separate `PublicProduct` and protected admin product projections and prove redaction at serialization boundaries.
- A confirmed/shipping order with net collected payment cannot be cancelled until the actual refund has been recorded or an erroneous payment has been reversed. Refund records are immutable, reference the source payment/order, require confirmation, and never imply that Giaban or MCP transferred money externally.
- Draft discard is an audited, recoverable tombstone operation allowed only before confirmation and only when no payment or dependent reference exists. Deleting a non-draft legacy order maps to the validated cancellation workflow, never hard deletion.
- PII is masked in list/search output by default; detailed access requires customers:pii:read and produces a sensitive-read audit event.
- Every list/search operation is filterable and paginated with bounded response sizes. Every mutation validates input and authorization and emits audit evidence.
- Dangerous operations use server-issued, short-lived, actor-bound, payload-bound, single-use confirmation tokens and revalidate authorization and current revisions at execution.
- Use idempotency keys for retryable writes and optimistic concurrency/revisions for conflicting edits. Never silently apply last-write-wins to financial or order workflows.
- D1 is the default technical source of truth. Add Durable Objects only if measured contention or ordering requirements justify a specific coordination atom; do not use them merely to hold MCP transport sessions.
- Restore must use an explicit maintenance lease/write fence and an inactive logical dataset generation (or a Phase-2-proven equivalent) so multi-table import is never partially visible. Only a validated confirmation may atomically switch the active generation; old generations remain bounded rollback artifacts under retention policy.
- Legacy frontend session tokens are mapped to a server-side operation allowlist capped at workflows the compatibility frontend actually needs. They never inherit MCP-only, audit, PII-export, merge/unmerge, refund/reversal, role/grant, or dataset-cutover authority merely because the principal is the owner.
- Initial MCP acceptance uses Pi, but protocol contracts, tool schemas, auth discovery, and transports remain standards-based and client-neutral.
- No implementation phase may claim success from plan text or metadata. Completion requires executable evidence, migration reconciliation, and observable acceptance.

## Evidence Baseline And Gap Matrix

Evidence classifications below are based on repository files read on 2026-09-03. Platform statements are planning-time confirmed against the linked primary documentation but must be refreshed before implementation because MCP and Cloudflare APIs evolve.

| Capability | Current state and evidence | Target state | Priority and acceptance signal |
| --- | --- | --- | --- |
| Business persistence | Confirmed: `cloudflare_worker.js` reads and overwrites whole JSON values in KV through `/api/data/:key`; `workerContract.js` defines three public and seven private keys. | Normalized D1 records with constraints, revisions, transactions, and repository-owned migrations. | P0: isolated D1 tests prove atomic workflows, conflicts, and immutable financial records. |
| Write correctness | Confirmed: `businessService.ts` performs client-side read/modify/write of complete arrays; `apiService.save()` writes local cache first and returns success regardless of the cloud result. | Cloud-authoritative commands fail closed, require idempotency for retryable writes, and use optimistic revisions for mutable aggregates. | P0: duplicate retries replay one result; concurrent stale writes return a typed conflict without lost updates. |
| Domain ownership | Confirmed: totals, customer matching, lifecycle changes, debt, and reporting are distributed through `hooks/useBusinessData.ts` and business UI components. | One domain/application core owns every invariant; REST, frontend, Service Binding, and MCP are adapters. | P0: transport-equivalence tests produce the same outcomes and errors through REST and MCP. |
| Customer identity | Confirmed: customer lookup currently matches phone or name and then writes customer and order separately. | Stable `customerId`, duplicate warnings rather than inferred identity, order-time contact snapshots, and audited reversible merge workflows. | P0: ambiguous matches never auto-merge; merge/unmerge tests preserve references and audit lineage. |
| Orders and payments | Confirmed: `debt` is both added to order total and used as payment state; paid/unpaid toggles rewrite order/customer values in separate writes. | Explicit lifecycle, immutable order events, independent partial-payment ledger, reversals, and derived receivables. | P0: financial invariant and legal-transition suites pass; no mutable customer debt truth remains. |
| Reporting | Confirmed: `ProfitTab.tsx` and `ReportsTab.tsx` calculate revenue differently. | Backend reports expose confirmed sales, cash receipts, receivables, discounts, shipping, COGS, and profit separately. | P1: UI and MCP validate against the same report fixtures and serialized contract. |
| Authentication and authorization | Confirmed: the Worker issues one signed eight-hour admin session with no user identity, role, or business scopes. | GitHub-backed OAuth for MCP, immutable owner identity, revocation, least-privilege scopes, and application-level enforcement. | P0: wrong owner, issuer, audience, expiry, revocation, and insufficient-scope cases fail closed. |
| Privacy and audit | Confirmed: current private-key authorization has no PII projection policy or sensitive-read audit. | Masked list/search projections, explicit PII detail scope, mutation/sensitive-read audit, and redacted observability. | P0: default output contains no full PII; an authorized detail read commits an audit event before returning. |
| Public catalog confidentiality | Confirmed: `ProductVariant.costPrice` is part of the `products` shape while `products` is a public KV key, so blindly rebuilding the current document could expose price-cost data. | A dedicated public product DTO/projection excludes cost, margin, bank, and all admin-only fields; protected catalog operations use a distinct admin DTO. | P0: public API, KV projection, browser cache, and MCP public-safe output are schema-tested to contain no cost field; admin detail remains authorized. |
| MCP | Confirmed: no MCP SDK, transport, tool registry, OAuth metadata, or MCP tests exist in the repository. | Client-neutral stateless Streamable HTTP MCP edge with strict schemas, bounded structured output, actionable errors, and accurate annotations. | P1: current MCP Inspector and an actual Pi session pass discovery, OAuth, and representative workflows. |
| Frontend consistency | Confirmed: admin business state can fall back to `localStorage`; public catalog and shopper cart also use local storage. | Admin reads/writes use the domain API; only shopper cart and bounded revisioned public cache remain local. | P1: offline writes visibly fail, stale reads are labelled, and no unpersisted write is reported successful. |
| Migration and recovery | Confirmed: backup/restore and sync operate across independent whole-document writes and can partially succeed. | Deterministic staging import, exception quarantine, reconciliation, short write freeze, authoritative cutover marker, and recovery by cutover boundary. | P0: repeatable migration and rollback rehearsals reconcile counts, references, money, and manifests. |

## Architecture Specification

### Selected topology

Use two Cloudflare deployments with one business-data trust boundary:

```text
Pi or another MCP client
        |
        | Streamable HTTP + Giaban MCP access token
        v
MCP Edge Worker (new deployment; provisional name `ksht-mcp`)
  - `/mcp` and OAuth discovery/authorization/callback/token routes
  - GitHub upstream identity and MCP-bound token lifecycle
  - strict MCP tool adapter, output bounds, channel rate limits, kill switch
  - bindings: isolated OAuth state/rate limit/secrets and `DOMAIN` Service Binding
  - explicitly no D1, legacy business KV, or public catalog KV binding
        |
        | one typed, coarse-grained Service Binding invocation per tool call
        v
Domain/API Worker (evolution of current `ksht-api`)
  - versioned public/admin REST API for the frontend
  - named MCP domain entrypoint, not a public duplicate API
  - authentication-to-principal mapping and authoritative scope/policy checks
  - domain/application core, D1 repositories, idempotency, confirmations, audit
  - sole `BUSINESS_DB` writer and owner of public KV projection publication
        |
        +--> D1: authoritative business data
        +--> KV: rebuildable public catalog/settings projection only
        +--> temporary legacy KV adapter during expand/contract migration
```

The MCP Worker is a protocol and identity adapter, not a second business backend. It never receives a business-storage binding and never calls the Domain/API Worker through public HTTP. The Domain/API Worker remains the only process capable of business DML and must re-check current principal status, operation scopes, revisions, confirmation intent, idempotency, and domain invariants for every Service Binding call.

The exact production service names, hostnames, binding names, OAuth application settings, and resource IDs are deliberately deferred to Phase 9 because creating or changing them is an external operation requiring separate authority.

### Architecture selection record

Three materially different designs were assessed:

| Candidate | Strength | Cost/risk | Decision |
| --- | --- | --- | --- |
| A — REST and MCP in one modular Worker with direct D1 access | Lowest latency and operational overhead; one atomic deployment. | MCP/OAuth/protocol changes share blast radius and the MCP module resides in a process holding the full business binding. | Rejected as the default because the accepted MCP surface has comprehensive write authority and warrants independent containment and rollback. It remains the fallback if Service Binding support or operating cost is disproven in Phase 0. |
| B — Separate API and MCP Workers, both compiling the domain package and directly binding the same D1 | Independent transport deployment without an internal call. | D1 bindings grant resource-level capability rather than table/operation-level isolation; two independently deployed writers require a schema/writer compatibility matrix. | Rejected: deployment separation without storage-capability separation does not provide enough additional safety. |
| C — Separate MCP edge Worker calling the sole Domain/API Worker through a typed Service Binding | MCP has no direct storage capability; OAuth/protocol rollout and kill switch are independent; domain transactions stay localized. | One internal invocation, two deployments, explicit identity propagation, and contract compatibility proof are required. | Selected: strongest security/recovery boundary with acceptable complexity for a full-authority MCP. |

This selection refines the earlier provisional same-Worker option after an explicit design comparison. It does not authorize creation of the second Worker or any Cloudflare resource.

### Proposed repository ownership and layout

Final names may adapt to existing build constraints, but ownership must remain equivalent:

```text
contracts/
  giaban-api.openapi.yaml          # sole machine-checkable public operation contract
  examples/                        # synthetic, non-sensitive contract examples
server/
  domain/                          # pure money, identity, lifecycle, ledger, report rules
  application/                     # typed commands/queries and authorization policy
  persistence/d1/                  # sole business D1 adapter
  persistence/kv-projection/       # rebuildable public projections
  safety/                          # idempotency, confirmation, audit, redaction
  migration/                       # deterministic legacy transforms/reconciliation
workers/
  api/                             # REST adapter and named domain Service Binding entrypoint
  mcp/                             # OAuth, MCP transport, tool registry, Service Binding client
migrations/                        # one ordered D1 migration stream
scripts/migration/                 # non-production export/import/reconcile tooling
tests/
  domain/ contract/ integration/ mcp/ migration/
wrangler.jsonc                     # Domain/API Worker; evolved from current config
wrangler.mcp.jsonc                 # separate MCP Worker; no business storage binding
```

Do not relocate unrelated frontend files merely to match this diagram. Introduce directories incrementally and keep generated artifacts in explicit, reviewable paths.

### Authoritative contract and deep seam

`contracts/giaban-api.openapi.yaml` is the single authoritative OpenAPI 3.1 operation and payload contract for independently deployed consumers/providers. It owns stable `operationId` values, request/result schemas, nullability/defaults/enums, pagination, revisions, idempotency, confirmation shapes, required scopes, documented domain errors, and compatibility policy. Locally resolved schemas only; remote `$ref` values are forbidden.

The contract may use a reviewed `x-giaban-mcp` extension to bind an operation to one MCP tool name and its annotations. Frontend types/client code, runtime validators, Service Binding DTOs, MCP input/output schemas, synthetic fixtures, and documentation are derived from or mechanically checked against this artifact; none becomes an independently editable contract. Phase 0 must select and pin the smallest validator/generator set before generated code is accepted.

The Domain/API Worker exposes one small, deep application seam:

```ts
interface GiabanApplication {
  query(request: BusinessQuery, context: InvocationContext): Promise<QueryResult>;
  execute(request: BusinessCommand, context: InvocationContext): Promise<CommandResult>;
  preview(request: DangerousCommand, context: InvocationContext): Promise<ConfirmationPreview>;
  confirm(request: ConfirmedCommand, context: InvocationContext): Promise<CommandResult>;
}
```

The named Worker entrypoint exposes one typed `invoke(envelope)` RPC operation whose discriminated operation IDs and input/output shapes come from the authoritative contract. It must runtime-validate both input and output. Unknown operations fail closed. REST and MCP adapters may map transport details but may not calculate totals, resolve customer identity, transition orders, allocate payments, mask PII, or interpret domain errors independently.

`InvocationContext` contains the verified principal, source channel, granted token scopes, request/correlation ID, idempotency key, expected revision, confirmation token when applicable, and trusted clock. Raw GitHub tokens never cross the Service Binding. The Domain Worker must not trust caller-supplied actor fields: Phase 0 must select a verifiable, short-lived, audience-bound internal principal assertion or equivalent platform-supported mechanism, and the Domain Worker must intersect asserted scopes with the principal's current active direct grants and activation/revocation state before executing. Role-derived grants are added only after a concrete future role is authorized.

### Domain modules and ownership

| Module | Owned behavior | Authoritative records/projections |
| --- | --- | --- |
| Catalog | Product/category validation, variants, archive/restore, explicit public/admin DTO separation, public publication. | Categories, products, variants; cost-free revisioned public projection and protected admin projection. |
| Customers | Stable identity, normalized searchable contacts, duplicate warnings, archive/restore, merge/unmerge lineage. | Customers, contacts, aliases/merge events; masked and PII detail projections. |
| Orders | Draft editing, price/cost/contact/shop snapshots, totals, legal lifecycle, cancellation, cloning. | Orders, lines, status events; current status/revision projection. |
| Payments/receivables | Partial/full order payments, actual-refund recording, erroneous-entry reversals, cancellation settlement checks, derived outstanding balances. | Immutable payments, refund/reversal links, and derived receivable queries. |
| Cash transactions | Non-order income/expense entries and corrections. | Immutable cash entries and reversal links. |
| Reporting | Confirmed sales, gross receipts, refunds, net receipts, receivables, discounts, shipping, COGS, gross profit. | Backend query projections only; no client-owned formula. |
| Settings/templates | Phone/shop/bank/tax settings, active/default template invariants, invoice snapshots. | Versioned settings and templates; public-safe settings projection. |
| Identity/access | Principals, immutable external identities, direct scope grants, activation/revocation, and a seam for future role policy. | Minimal owner principal/scope records; OAuth state remains isolated in MCP Worker storage. |
| Safety/audit | Idempotency replay, optimistic revisions, confirmation intents, mutation and sensitive-read audit. | Idempotency, confirmation, append-only audit, projection outbox. |
| Migration/backup | Source manifests, deterministic mapping, exceptions, reconciliation, logical dataset generations, maintenance fencing, and private artifact lifecycle. | Migration runs/maps/exceptions/manifests, active-generation metadata, and opaque upload/download handles. |

### Core data and invariant specification

- Store VND monetary values as checked non-negative integers where the domain forbids negatives; represent corrections with typed reversal records rather than negative mutation of history. Reject unsafe JavaScript integers at every boundary.
- For each line, compute the effective quantity as `quantity` multiplied by each positive optional `soCuon` and `soKi` factor. Sale subtotal and COGS use the same effective quantity with their respective snapshotted unit prices. Manual lines remain supported but obey the same validated calculation.
- Draft lines may change. Confirmation freezes sale price, cost input, quantity factors, customer contact snapshot, seller/template snapshot, discounts, shipping, and calculated totals. Later lifecycle transitions do not rewrite those snapshots.
- `order.total = lineSubtotal - discount + shippingFee`; previous customer debt is never part of a new order total. Drafts and cancelled orders do not count as confirmed sales.
- Legal lifecycle is `draft -> confirmed -> shipping -> completed`, with cancellation from `confirmed` or `shipping`, a required reason, and no reopen. Correct a cancelled order by cloning it into a new draft. Payment state is independent.
- A payment belongs to an order for the initial domain model, may be partial, may not make the order overpaid, and is immutable. A reversal corrects an erroneous payment record without pretending cash moved; a refund records owner-confirmed cash returned externally, references the source payment/order, and is also immutable. For each payment, `reversedAmount + refundedAmount <= paymentAmount`; reversal and refund entries consume the same remaining valid amount and cannot double-consume it under retries or races. For an active order, `netCollected = sum(paymentAmount - reversedAmount - refundedAmount)` and `outstanding = orderTotal - netCollected`, both constrained non-negative. Cancellation requires `netCollected === 0`; a cancelled order has zero collectible outstanding. Gross-receipt reports subtract reversals as invalid records, report refunds separately, and compute net receipts as valid gross receipts minus refunds.
- Cash income/expense entries are distinct from order payments so reports cannot double-count sales collection. Corrections use reversal records.
- Customer names and phones are searchable attributes, not identity. Orders require a stable `customerId` after migration and preserve sale-time customer details. Merge changes canonical references through an audited mapping; unmerge uses recorded lineage rather than guessing.
- Exactly one active shop template is default when templates exist. Confirmed orders preserve the seller/template snapshot needed to reproduce historical invoices even if settings later change.
- Store timestamps in UTC and apply an explicit business timezone, initially `Asia/Ho_Chi_Minh`, when defining report date boundaries and display. The contract must distinguish date-only business ranges from instants.
- Mutable aggregates expose monotonic integer `revision`. Existing-record writes require `expectedRevision`; zero-row conditional updates become `REVISION_CONFLICT`, never silent last-write-wins.
- Mutations requiring safe retry accept an explicit idempotency key. Uniqueness is at least `(principalId, operationId, idempotencyKey)`: same key/same canonical payload replays the committed result; same key/different payload returns `IDEMPOTENCY_CONFLICT`.
- Business mutation, idempotency result, confirmation consumption where applicable, append-only audit, and projection outbox event commit in the same D1 transaction boundary. If current D1 primitives cannot prove a workflow atomic, stop and redesign that workflow rather than splitting writes.
- A confirmation intent is opaque, short-lived, single-use, and bound to principal, OAuth client, operation, canonical payload hash, required scopes, target IDs/revisions, impact summary, and expiry. Confirm revalidates every binding immediately before mutation.
- Audit records include actor/channel/client, operation, target IDs, request ID, time, revisions, outcome, idempotency/confirmation references, and a redacted change hash or summary. They never contain credentials, complete request payloads, or unnecessary clear PII.
- Public KV documents include source revision/schema/freshness metadata and are rebuildable from D1. Projection publication failure does not undo committed business state; it creates retryable outbox work. Nothing syncs KV or browser cache back into D1 implicitly.
- The public catalog publisher constructs a dedicated allowlisted DTO and never serializes the protected product model wholesale. `costPrice`, cost snapshots, COGS, margin, bank data, and future unknown admin fields fail contract validation rather than appearing in public API/KV/cache output.
- Business records participating in backup/restore are scoped to a logical `datasetGenerationId`. Restore uploads and validates an inactive generation while reads continue from the active generation; a maintenance lease fences mutations before confirmation atomically changes the active-generation pointer. If this model cannot be proven with current D1 primitives in Phase 2, restore execution remains disabled until an equally atomic design is accepted.

### Minimum D1 schema groups

Exact columns and indexes belong to Phase 2 migrations, but the schema must cover:

- `categories`, `products`, `product_variants`;
- `customers`, `customer_contacts`, `customer_merge_events`;
- `orders`, `order_lines`, `order_status_events`;
- `payments`, `payment_reversals`, `payment_refunds`;
- `cash_transactions`, `cash_transaction_reversals`;
- `app_settings`, `bank_settings`, `tax_settings`, `shop_templates`;
- `principals`, `external_identities`, `principal_scope_grants`; introduce role tables only with a concrete second-role requirement and compatible migration;
- `idempotency_records`, `confirmation_intents`, `audit_events`, `projection_outbox`;
- `dataset_generations`, `active_dataset`, `maintenance_leases`, `migration_runs`, `migration_source_maps`, `migration_exceptions`, `backup_manifests`, and artifact grant metadata.

Use database foreign keys, uniqueness, check constraints, and immutable-ledger protections where supported and verified. Derived totals such as customer debt and lifetime spend are queries/projections, not independently mutable columns. OAuth clients, grants, authorization codes, tokens, and GitHub upstream state are isolated from business tables and owned by the MCP edge Worker/provider implementation.

### Scope model

| Scope | Allows | Does not imply |
| --- | --- | --- |
| `catalog:read`, `catalog:write` | Read catalog; create/update/archive/restore catalog entities. | Settings, customer, order, or infrastructure access. |
| `customers:read`, `customers:pii:read`, `customers:write`, `customers:merge` | Masked queries; explicit detailed PII; profile mutation; confirmed merge/unmerge. | Order/payment mutation or unbounded export. |
| `orders:read`, `orders:write`, `orders:lifecycle`, `orders:cancel` | Query; draft mutation; normal transitions; confirmed cancellation. | Payment reversal or hard delete. |
| `payments:read`, `payments:write`, `payments:reverse`, `payments:refund` | Payment/receivable queries; record collection; correct erroneous records; record an externally completed refund. | Editing historical rows or initiating bank/payment-provider transfers. |
| `transactions:read`, `transactions:write`, `transactions:reverse` | Cashbook queries; new entries; confirmed reversals. | Cloudflare or arbitrary ledger administration. |
| `reports:read` | Bounded backend reports. | Raw table dumps or implicit PII detail. |
| `settings:read`, `settings:write` | Business settings, bank/tax, and templates. | Worker bindings, secrets, routes, or deployment. |
| `backups:export`, `backups:import`, `backups:restore` | Audited PII-bearing export, artifact upload/finalization, and confirmed logical-generation restore. | Ordinary unbounded MCP response, external storage administration, or bypassing PII-export policy. |
| `audit:read` | Bounded, redacted business audit queries. | Secret/token access or mutation of audit history. |

The initial owner principal may be granted all listed business scopes directly, but tokens still carry explicit approved scopes. Do not implement a generic role hierarchy until a concrete second role exists. Operation policy is enforced in the Domain Worker even when the MCP adapter already checked it; legacy browser sessions receive a separate capped operation allowlist rather than this full grant set.

### MCP tool contract

The authoritative operation registry must produce at least these discoverable, `giaban_`-prefixed capabilities; Phase 5 may split a tool only when input/output complexity or independent authorization justifies it:

- System: `giaban_get_status`, `giaban_get_capabilities`.
- Catalog: list/search/get/create/update/archive/restore products; list/create/update/archive/restore categories.
- Customers: list/search masked customers, get PII-gated detail, create/update/archive/restore, preview/confirm merge, preview/confirm unmerge.
- Orders: list and masked get, PII-gated order/invoice detail, create/update draft, audited discard/restore draft, confirm, mark shipping, complete, clone, preview/confirm cancellation. Cancellation preview reports unsettled payment/refund requirements and confirm fails while net collected value remains.
- Payments: list payments, list receivables, record partial/full order payment, preview/confirm erroneous-payment reversal, and preview/confirm recording of an externally completed refund. No tool initiates a bank or payment-provider transfer.
- Cash transactions: list/create income or expense, preview/confirm reversal.
- Reports: summary, confirmed sales, gross receipts/refunds/net receipts, receivables, discounts/shipping, and COGS/profit.
- Settings/templates: get/update phone/shop/bank/tax settings; list/create/update/archive/restore templates; set default template.
- Backup/restore: preview/confirm export creation, get bounded manifest/status, create a short-lived audited download grant, create an upload intent, finalize and validate an uploaded artifact into an approved handle, preview restore into an inactive dataset generation, and confirm the maintenance-fenced active-generation switch.
- Audit: bounded/redacted audit search for the owner.

Every list/search/report requires filters or a bounded default, cursor pagination where results can grow, explicit maximum page/range limits, `hasMore` and opaque next cursor metadata. Customer and order list/get projections mask contact snapshots; any customer, order, invoice, or audit detail containing clear contact data requires `customers:pii:read` and successful sensitive-read audit. Backup export is an explicitly PII-bearing privileged operation under dedicated export scope and audit. Large backup payloads never travel as ordinary tool output; a private artifact-store adapter provides time-limited upload/download grants, integrity manifest, retention, and cleanup, and its production resource requires separate authority.

### Backup artifact and restore lifecycle

- A business backup manifest allowlists catalog, customers/contact snapshots, orders/events/lines, payment/refund/reversal records, cash ledger, business settings/templates, and dataset-linked audit/provenance required to interpret them. It excludes OAuth clients/codes/tokens, GitHub tokens, sessions, secrets, principal scope grants, idempotency records, confirmation intents, maintenance leases, rate-limit state, transient outbox rows, and artifact credentials. Public projections are rebuilt, not restored as truth.
- Export lifecycle is `building -> ready -> expired -> deleted`, with `failed` and owner-requested `aborted` terminal paths. Import lifecycle is `uploading -> uploaded -> validating -> approved` or `rejected/aborted`; only `approved` artifacts can create an inactive restore generation. A separate restore run tracks staging, reconciliation, readiness, active-generation switch, failure, and cleanup so artifact approval never means restore success.
- Upload/download grants are opaque, narrowly scoped to one artifact and direction, short-lived, revocable, auditable, and preferably single-use. Creation and use require the relevant backup scope; payload transfer uses a dedicated authenticated streaming endpoint or provider primitive, not MCP content or logs.
- Manifest schema/version, byte and record limits, content-type, per-section counts/checksums, whole-artifact integrity, origin, dataset generation, creator, and creation time are validated before `ready`/`approved`. Restore rejects unknown sections/fields and incompatible schema rather than importing them opportunistically.
- Abort, validation failure, grant expiry/revocation, interrupted upload/export, retention expiry, and orphan detection all have bounded cleanup jobs and retry/failure evidence. Payload deletion is verified; a redacted immutable manifest/audit record remains under the selected policy. Exact retention durations and production artifact backing remain Phase-0/9 decisions and do not block local adapter implementation.

Tool annotations must match actual behavior but are hints only: reads are read-only/non-destructive; preview is read-only only when it creates no durable intent, otherwise it is a non-destructive mutation; confirm/cancel/archive/restore/reversal tools are destructive as appropriate; `idempotentHint` is true only when the full operation is demonstrably replay-safe; closed Giaban business operations use `openWorldHint: false`.

### Error, compatibility, and observability contract

The contract must define stable machine-actionable codes including `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_TRANSITION`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_EXPIRED`, `CONFIRMATION_STALE`, `RATE_LIMITED`, `MIGRATION_READ_ONLY`, and `INTERNAL_ERROR`. REST maps them consistently to HTTP; MCP returns tool-level errors with the same code, safe message, retryability, and next action. Internal causes and sensitive values stay server-side.

Breaking changes use an explicit contract version and expand/contract migration. During the migration window, frontend, Domain Worker, and MCP Worker publish non-sensitive contract/build compatibility metadata and accept the required N/N-1 range. Schema changes are expand-first; no destructive migration or legacy field removal occurs while a deployed consumer still needs it.

Structured logs and traces use correlation/request IDs across MCP and Service Binding calls. Record operation, duration, safe target metadata, result code, revision/conflict, idempotency replay, confirmation state, and projection lag; never log Authorization headers, OAuth/GitHub tokens, secrets, full PII, backup contents, or unredacted payloads. Define alert thresholds from staging evidence rather than arbitrary plan-time numbers.

### Platform references checked for this specification

- MCP latest specification and Streamable HTTP/authorization: `https://modelcontextprotocol.io/specification/latest`, `https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http`, and `https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization`.
- Cloudflare remote MCP/stateless handler guidance: `https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/` and `https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/`.
- Cloudflare Service Bindings and RPC: `https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/` and `https://developers.cloudflare.com/workers/runtime-apis/rpc/`.
- Cloudflare D1 Worker API/transactions: `https://developers.cloudflare.com/d1/worker-api/d1-database/`.

These links record planning evidence, not pinned implementation authority. Phase 0 must re-fetch the current pages and repository-pinned Wrangler schema before code or config is written.

## Approach

- Phase 0 — Refresh evidence and freeze the contract: re-read repository authority and current implementation; retrieve current official MCP, TypeScript SDK, Cloudflare MCP, Service Binding/RPC, D1, OAuth-provider, Wrangler-schema, and Pi MCP-client documentation; inventory every existing frontend workflow and legacy KV shape without exposing live values; finalize `contracts/giaban-api.openapi.yaml`, local references, operation IDs, scope/error/revision/idempotency/confirmation conventions, compatibility policy, internal principal assertion, tool inventory, and selected validator/generator versions before provider or consumer code.
- Phase 1 — Establish the domain core through behavior tests: implement pure VND money and checked arithmetic, line factors, order totals, price/cost/seller/customer snapshots, customer identity/merge lineage, lifecycle transitions, partial payment/outstanding/reversal rules, archive/restore, template defaults, timezone boundaries, and report calculations behind the `GiabanApplication` seam. Keep transport, browser, D1, KV, and OAuth details outside the core.
- Phase 2 — Build D1 persistence and safety primitives: create the one ordered migration stream, normalized schema, constraints/indexes, repository/unit-of-work adapter, monotonic revisions, idempotency records, confirmation intents, append-only audit, projection outbox, logical dataset generations, maintenance fencing, migration/artifact metadata, and isolated test database support. Prove each business command's transaction boundary, including stale-precondition rollback, audit/idempotency atomicity, inactive-generation restore visibility, atomic generation switch, and fault-injected restore recovery.
- Phase 3 — Deliver the Domain/API Worker, compatibility lane, and first frontend catalog vertical slice: evolve `ksht-api` into the sole business writer; add validated `/api/v1` resource/workflow endpoints and one named typed Service Binding entrypoint over the application seam; map existing frontend sessions to a separately capped legacy operation allowlist; implement consistent errors, cursor pagination, revision preconditions, idempotency, distinct cost-free public versus protected admin product/order/customer projections, and allowlist-only public KV publication. Before any environment redacts the public product projection, migrate and prove the admin catalog UI against the protected cost-bearing endpoint; retain only the minimum known legacy adapter needed for expand/contract and forbid unknown/raw business keys.
- Phase 4 — Deliver the isolated OAuth/MCP shell: add the separately configured MCP edge Worker without business storage bindings; implement protected-resource and authorization metadata, GitHub upstream login by immutable numeric user ID, consent, MCP-bound token issuance/validation/revocation, explicit scopes, Service Binding client, internal principal assertion, rate limits, structured redacted observability, and independent read/write/whole-channel kill switches. Initially expose only status/capabilities with all business mutations disabled.
- Phase 5 — Deliver MCP vertical slices in dependency order: cost-safe catalog; masked/PII-detailed customers and merge/unmerge; order drafts, discard/restore, lifecycle and paid-order cancellation guard; payments/receivables/reversals/refund recording; cash transactions; reports; settings/templates; audit search; private backup artifact upload/download and logical-generation restore. For each slice, change/freeze the authoritative contract first, then implement the Domain operation, REST mapping where applicable, MCP mapping, schema validation, pagination/output bounds, scope and PII policy, revision/idempotency/confirmation controls, and public-seam tests before enabling the next slice.
- Phase 6 — Complete frontend consumer migration after the Phase-3 admin catalog slice: replace every remaining local-first business write and component-owned rule with the contract-derived API client; preserve cost-free public catalog behavior and the local shopper cart; expose loading, stale-cache, offline, authorization, conflict, and retry states honestly; remove duplicated finance, identity, and lifecycle calculations only after replacement contract and end-to-end tests pass. Do not enable MCP writes while any revisionless whole-key frontend writer remains active.
- Phase 7 — Rehearse legacy data migration: implement non-production snapshot manifests and deterministic transform/import/reconcile tooling; preserve source values and IDs where valid; assign deterministic mappings where required; quarantine ambiguous customer matches, historical cost, debt/payment, and order-status cases; generate counts, reference checks, monetary comparisons, checksums, and exception dispositions. Repeat from a clean isolated D1 database until results are reproducible and rollback is rehearsed.
- Phase 8 — Prove integrated behavior and recovery in local/staging environments: validate actual REST, RPC, and MCP serialized output against the same contract; run domain, D1, authorization, scope, privacy, concurrent-write, idempotency, confirmation, migration, and frontend suites; use the current MCP Inspector and an actual Pi session for OAuth/tool workflows; exercise channel disablement, compatible code rollback, projection rebuild, pre-write storage rollback, and post-write roll-forward/compensation paths.
- Phase 9 — Prepare but do not perform production provisioning or cutover without separate authority: inspect only authorized metadata and define exact account/Worker/D1/KV/artifact-store targets, service bindings, GitHub OAuth app, secrets, hostnames, compatibility settings, generated Env types, backup identifiers, maintenance communication, write-freeze procedure, readiness/canary probes, alert thresholds, cutover marker, rollback triggers, and commands from refreshed official documentation.
- Phase 10 — Perform a separately authorized staged rollout: deploy compatible expand-only Domain/API capability first, including protected admin catalog reads; deploy the Phase-3 frontend catalog slice and then the remaining `/api/v1` frontend workflows; verify admin cost access and no revisionless client; deploy MCP OAuth/status with mutation kill switches; freeze writes; take the immutable KV snapshot; import and reconcile D1; atomically switch the authoritative dataset marker, publish the cost-free public projection, and hard-gate every legacy whole-key POST across all public and private keys as `MIGRATION_READ_ONLY` before the first D1-served business write; enable frontend writes, then MCP reads, then MCP mutation families incrementally; run only authorized synthetic/status probes and monitor predefined signals.
- Phase 11 — Contract and cleanup in a later separately validated release: remove the already-disabled legacy whole-key write code and obsolete client-owned business logic only after the rollback window closes and all consumers are proven on D1; retain required compatibility reads for the documented window; rebuild public projections; update operational documentation; run fresh proof before declaring the plan complete or moving it to completed.

### Phase gates and handoff evidence

| Phase | Required deliverables | Exit gate | Recovery if the gate fails |
| --- | --- | --- | --- |
| 0 | Evidence inventory, authoritative OpenAPI contract, operation/tool/scope matrix, pinned design choices. | Contract lint/validation and explicit review of every current workflow and confirmed invariant. | Revert document/contract-only changes; no runtime state exists. |
| 1 | Pure domain/application modules and synthetic fixtures. | Domain suite proves calculations, transitions, identity, ledger, and reports without adapters. | Revert code; no storage migration or external action. |
| 2 | D1 migrations, repositories, safety/audit primitives, dataset-generation restore, isolated DB harness. | Fresh migrate/test/recreate cycle and atomicity/conflict/idempotency/restore fault-injection evidence pass. | Discard isolated database or inactive generation; fix forward migration before continuing. |
| 3 | Domain/API Worker, `/api/v1`, named Service Binding entrypoint, protected admin catalog/frontend slice, cost-safe public projection, temporary compatibility adapter. | Actual REST/RPC output validates; admin cost workflows pass through the protected endpoint; public output has no cost/admin fields; current Worker security tests remain green; legacy scopes/behavior are explicitly capped, mapped, or rejected. | Keep the existing KV Worker path authoritative and the old projection unchanged; do not route production traffic. |
| 4 | MCP Worker shell, GitHub OAuth, scope/revocation policy, status tools, kill switches. | Inspector and Pi authenticate in non-production; wrong identity/token/scope fails; MCP config has no business storage binding. | Disable/remove MCP route and revoke non-production grants; frontend unaffected. |
| 5 | Contract-first business tool slices, including refund-safe cancellation and complete private artifact lifecycle. | Each slice has Domain, REST where applicable, MCP, scope, PII, replay/conflict, and error evidence before enablement. | Disable only the failing tool family; no raw fallback tool. |
| 6 | Contract-derived frontend client and migrated workflows. | Storefront/admin acceptance passes and offline/conflict states are truthful; whole-key writer detection shows none active. | Roll back to a contract-compatible frontend while D1 remains disabled or authoritative according to the cutover marker. |
| 7 | Deterministic migration and reconciliation reports. | Repeated clean imports match manifests; every blocking exception has explicit disposition; rollback rehearsal passes. | Discard staged D1 and preserve the source snapshot unchanged. |
| 8 | Integrated staging evidence and recovery rehearsal. | All mandatory checks and Pi end-to-end scenarios pass with no unresolved security/financial blocker. | Return to the earliest failing phase; production remains untouched. |
| 9 | Exact production runbook facts and authorization gates recorded in this plan. | User explicitly authorizes each provisioning/deploy/migration target and recovery is ready. | Stop with no external mutation. |
| 10 | Authorized expand, migration, cutover, all-key raw-write hard gate, controlled enablement, monitoring. | Every legacy whole-key POST, public and private, returns `MIGRATION_READ_ONLY` before D1 writes; the public projection is cost-free; reconciliation, synthetic probes, audit/write counts, auth failures, conflicts, and projection lag stay within recorded gates. | Before first D1 write restore the KV writer lane; after D1 writes keep all legacy writes disabled, freeze, and roll forward/compensate rather than restoring stale KV. |
| 11 | Compatibility removal and final documentation. | Fresh full verification, result evidence, and recovery state are recorded; no required check is failed/skipped. | Re-enable only a still-compatible read lane; never re-enable revisionless business writes. |

## Risks And Recovery

- Whole-document KV data and separate order/customer writes may already be inconsistent. Never silently infer repairs; stage originals, produce exception reports, and keep source snapshots unchanged.
- A direct MCP wrapper over `/api/data/:key` would expose excessive authority and preserve lost-update behavior. Prevent this by making tools call only typed application use cases and by hard-disabling every public/private whole-key write at D1 cutover before later removing the route code.
- The current public product shape can include `costPrice`. Never copy the legacy `products` document into a new public projection; map through an allowlisted `PublicProduct` serializer and fail tests/build if cost or unknown admin fields appear.
- Mapping the legacy browser session directly to the new owner grant could silently expand its authority. Give compatibility sessions an explicit operation cap, test every denied new capability, and retire the cap with the old auth lane rather than broadening it.
- OAuth mistakes could lock out the owner or accept tokens for another audience. Prove discovery, PKCE/client behavior, immutable owner identity, issuer/audience/scope validation, token revocation, and a tested /mcp kill switch before rollout; retain the existing frontend auth lane until MCP auth is proven.
- Frontend and MCP may drift on fields, enums, nullability, totals, or errors. Use one authoritative contract and validate real provider serialization plus both consumers before each expand/contract step.
- D1 schema or money conversion errors could corrupt totals. Use integer currency representation, database constraints, fixture-based reconciliation, immutable source snapshots, and rollback before accepting writes.
- Cancelling an order with collected payment could orphan cash or hide a refund liability. Block cancellation until erroneous payments are reversed or actual returned cash is recorded through a linked, confirmed refund; Giaban records but does not execute external money movement.
- Multi-table restore could expose partial old/new state. Stage an inactive logical dataset under a maintenance fence, validate its manifest and schema, atomically switch the active generation, and use fault-injection tests; keep restore execution disabled if Phase 2 cannot prove this boundary.
- Retries or concurrent agents could duplicate payments/orders or overwrite updates. Require idempotency records, unique constraints, optimistic revisions, transaction boundaries, and explicit conflict responses; test race scenarios.
- PII or secrets could leak through tool output, errors, logs, backups, or test fixtures. Use synthetic fixtures, bounded/redacted logs, output schemas, dedicated sensitive-read scopes, audit metadata without secret values, and review all observability fields.
- Preview/confirm may execute stale or altered intent. Bind tokens to actor, scope, canonical payload hash, affected revisions, expiry, and one-time use; execution fails closed when any binding changes.
- Cutover can interrupt administration or split writes. Use a short explicit write freeze, readiness checks, one authoritative cutover marker, a preserved KV snapshot, and a server-side hard gate that disables all legacy whole-key writes, including `products`, `categories`, and `settings`, before any D1-served mutation; never dual-write indefinitely.
- Public catalog availability could regress when frontend storage behavior changes. Keep a versioned public read projection/cache, validate storefront behavior separately, and roll frontend back without reversing committed business records.
- Backup/restore can become an unbounded PII export or destructive overwrite. Use dedicated PII-bearing export/import/restore scopes, private artifact upload/download grants, strict manifests/checksums/retention/audit, logical generation staging, and preview-confirm; never expose backups through ordinary list tools.
- New dependencies or current SDK APIs may differ from planning-time guidance. Refresh primary docs, pin reviewed versions, inspect generated lockfile changes, and run Cloudflare dry-run/type generation before implementation acceptance.
- Production operations are not authorized by this documentation request. Any later session must stop before provisioning, secret changes, deploy, push, or live migration unless the user explicitly names and authorizes the action and target.

## Progress

- [x] Confirm Shared Understanding and create this architecture specification/execution plan.
- [x] Phase 0 — Refresh evidence and freeze the authoritative contract and implementation pins.
- [x] Phase 1 — Implement and prove the pure domain/application core.
- [ ] Phase 2 — Implement and prove D1 persistence and safety primitives.
- [ ] Phase 3 — Implement and prove the Domain/API Worker, Service Binding entrypoint, and compatibility lane.
- [x] Phase 4 — Implement and prove the owner-private `KSHT_API_KEY` MCP shell; GitHub OAuth cancelled.
- [ ] Phase 5 — Deliver and prove all approved MCP business tool slices.
- [x] Phase 6 — Migrate and prove the frontend consumer; eliminate revisionless business writers.
- [ ] Phase 7 — Rehearse and reconcile the deterministic KV-to-D1 migration and recovery.
- [ ] Phase 8 — Complete integrated staging, Pi acceptance, and recovery rehearsal.
- [ ] Phase 9 — Record production-specific facts and obtain action-specific authority.
- [ ] Phase 10 — Perform only the separately authorized staged production rollout.
- [ ] Phase 11 — Remove compatibility paths in a later validated release and record the final result.

### Local implementation evidence — 2026-09-04

- Contract: `contracts/giaban-api.openapi.yaml`, `contracts/PINS.md`, `npm run test:contract`.
- Domain/application: write fence, backup restore onto a new generation, owner/legacy/public contexts, `npm run test:application`.
- Sqlite unit-of-work persists/reloads/rolls back. Production `wrangler.jsonc` still points at KV `cloudflare_worker.js`. Local Domain worker entry is `workers/api/index.ts` + `wrangler.domain.jsonc` (not production-wired).
- HTTP `/api/v1` covers the OpenAPI path set. `DOMAIN_AUTHORITATIVE=1` rejects whole-key writes (423) and serves public `/api/data/products` without cost. Default compose still falls through to the KV worker.
- MCP: every registry tool is listed; catalog→order→payment→report works; tools/call can use `GiabanDomain.invoke` + HMAC assertion; GitHub authorize/callback is owner-gated (injectable user lookup). No live GitHub OAuth app.
- `client/giabanClient.ts` is the v1 client. Admin/storefront writers no longer POST `/api/data/:key`; they use `/api/v1` per-resource operations. Production KV Worker still accepts whole-key POST until a later authorized cutover. `DOMAIN_AUTHORITATIVE=1` is not enabled in production.
- KV transform/import/reconcile is local-only. No live KV export or production D1 import.
- No Pi session, MCP Inspector, or staging environment. Phases 9–11 unauthorized. No deploy, publish, push, or live Cloudflare mutation.
- Local Pi (non-production, isolated MemoryStore): `npm run mcp:local` serves `http://127.0.0.1:8788/mcp`. The local test bearer is accepted only with `TEST_OWNER_ID` and `LOCAL_MCP_BEARER`; do not put it on a public Worker. MCP 2026 results stamp `resultType: "complete"`. Restart `mcp:local` after handler changes, then `/reload`.
- Executable checks on this slice: `npm run test:platform` (53 pass, earlier local MCP slice), `npx tsc --noEmit`, `npm run build`, `npm run test:worker` (13 pass, earlier Worker slice).

### Phase 6 frontend evidence — 2026-09-04

- Removed `apiService.save` / `saveCloud`. Admin catalog, settings, customers, orders, payments, cash, bank/tax, and shop templates write through `giabanClient` `/api/v1` with `Idempotency-Key` and `If-Match-Revision`.
- Storefront reads `GET /api/v1/public/products|categories|settings` (no cost). Shopper cart stays local. Admin catalog uses protected `/api/v1/products` (cost-bearing).
- Order create: `createCustomer` (or reuse listed id) → `createDraftOrder` → `confirmOrder` → optional `recordPayment` for `total - debt`. Order total no longer includes previous debt.
- Delete order maps draft → discard, confirmed → preview/confirm cancel. Paid toggle records payment; unpaid toggle records refund. Customer debt is derived from receivables, not a writable field.
- JSON whole-file restore and whole-key sync-to-cloud are disabled (honest alert). Pull reloads `/api/v1`. Conflict/401/validation surface `CloudWriteError` instead of silent local success.
- Legacy allowlist expanded only for compatibility UI workflows (invoice, discard/cancel, payment refund, cash reverse, template archive). Merge/backup restore/audit remain 403 for legacy sessions.
- Writer detection: `npm run test:frontend` (1 pass). HTTP flow: `node --experimental-strip-types --test tests/http/phase6.test.ts` (1 pass). Application/legacy HTTP: 15 pass. `npm run typecheck` and `npm run build` pass. `test:worker` skipped (no Worker/auth/CORS/data-key change).
- Does not enable production MCP writes, `DOMAIN_AUTHORITATIVE=1`, KV→D1, deploy, GitHub OAuth, or Pages publish.

### Personal MCP convenience — 2026-09-04

- HTTP MCP accepts `KSHT_API_KEY` (or Bearer equal to that secret). It does not use admin password / `ADMIN_SECRET`. GitHub OAuth routes are not exposed. `LOCAL_MCP_BEARER` remains test-only.
- Cloudflare Free always-on: Worker `ksht-mcp` at `https://ksht-mcp.ngthanhhuy951.workers.dev/mcp` plus SQLite Durable Object `GiabanShop` (one owner instance). Worker only routes; domain state lives in the DO so Free 10ms CPU is not spent on catalog work. No production `ksht-api` KV, Pages, or `giaban.khosihuythao.com` route.
- `.mcp.json` points at that URL with header `KSHT_API_KEY=${KSHT_API_KEY}`. Secret is not in git. `npx wrangler secret put KSHT_API_KEY --config wrangler.mcp.jsonc` is still required before tools/call succeed.
- The earlier deployed version remains isolated until a separately authorized `ksht-mcp` deploy. Source/config now bind the existing live shop KV and use `LiveKvStore`: read-only initial legacy hydration, explicit ID/status/cost mapping, private canonical key, changed-document projection, strict public allowlists, same-key throttling, and DO roll-forward journal.
- Migration safety: ambiguous customer links/debt/totals or malformed/duplicate IDs make affected writes `MIGRATION_READ_ONLY`. The DO commit mirror prevents eventual-consistency reads after restart from rolling state backward; any mismatch blocks writes until KV catches up or explicit reconciliation handles an external edit. `getStatus` exposes only readiness and blocker count, not customer data.
- Personal MCP omits unfinished backup import/export/restore tools. Tests also prove MCP forwards idempotency/revision controls and rejects those unsafe tools.
- Tests `tests/mcp/live-kv.test.ts` prove current KV hydration, storefront-compatible product publication without unknown/cost fields, order/payment publication, scoped migration blocking, missing/duplicate-ID blocking, external-writer drift blocking, stale-read rollback prevention, and same-instance partial-write recovery. `npx wrangler deploy --dry-run --config=wrangler.mcp.jsonc` confirms `GIABAN_SHOP` and live `DB` bindings. No live data was read or changed and no deploy occurred.
- Final local evidence for this slice: `npm run test:platform -- --test-concurrency=1 --test-reporter=dot` passed 66/66; `npm run test:worker -- --test-reporter=dot` passed 13/13; `npm run test:frontend -- --test-reporter=dot` passed 1/1; `./node_modules/.bin/tsc --noEmit --pretty false`, `npm run build -- --mode production`, `git diff --check`, and Wrangler MCP dry-run passed. Build retains the existing >500 kB chunk warning.
## Decisions

- Business scope is comprehensive for existing Giaban capabilities; infrastructure administration and unrelated new product domains remain out of scope.
- Initial access is private owner-only through GitHub OAuth using immutable GitHub user identity; the authorization model remains role/scope extensible and client-neutral, with Pi as the first acceptance client.
- Cloud is the sole business source of truth. D1 owns normalized business records; KV owns only rebuildable public projections/cache and isolated OAuth state; browser local storage is never an admin write source.
- Public catalog schemas are distinct from protected admin schemas and exclude cost price, COGS, margins, bank data, and unknown admin fields by allowlist. Legacy browser sessions receive only a capped compatibility operation set, never the full MCP owner grant.
- The architecture uses a dedicated MCP edge Worker with no business storage binding and a typed Service Binding to a Domain/API Worker that is the sole D1 writer. This was selected over a same-Worker design and over two direct-D1 writers to reduce OAuth/MCP blast radius and enforce the business operation seam.
- `contracts/giaban-api.openapi.yaml` is the planned authoritative machine-checkable boundary artifact. Generated types, validators, REST serializers, RPC DTOs, MCP schemas, fixtures, and documentation must be derived from or checked against it.
- The Domain/API Worker owns authorization and all business invariants even when an outer adapter already checked a token or scope. The MCP Worker is not allowed to pass unverified actor fields as authority.
- Stable customer IDs, order-time customer snapshots, phone-based duplicate warning rather than identity, and audited reversible merges replace runtime phone-or-name matching.
- Orders use the confirmed lifecycle and preserve frozen sale/cost/customer/seller snapshots. Draft discard is audited/recoverable. Payments, refunds, and cash transactions are immutable records; reversal corrects an erroneous record, while refund records actual externally returned cash. Paid orders cannot be cancelled until net payment is settled, and receivables/reports are derived by backend rules.
- Lists and reports are bounded/filterable/paginated; PII is masked by default and detailed reads require `customers:pii:read` plus audit. No ordinary MCP tool returns an unbounded backup or data dump.
- Normal writes require validation, audit, revisions, and idempotency where retryable. Dangerous writes require server-issued actor/payload/revision-bound single-use confirmation and operation-specific scope.
- Migration is deterministic and staged: preserve immutable source snapshots, auto-normalize only certain cases, quarantine ambiguity, reconcile defined metrics, use a short write freeze, and never dual-write indefinitely.
- Business restore uses inactive logical dataset generations plus a maintenance fence and atomic active-generation switch; every legacy whole-key write is hard-disabled at D1 cutover before the first D1 business mutation, although read compatibility and later code removal may continue separately.
- Production resource creation, OAuth app configuration, secrets, deployments, publication, and live migration require later exact action-specific authorization; this documentation request grants none of them.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

### Deferred non-blocking implementation choices

- Exact current MCP/Cloudflare package versions and APIs; Phase 0 refreshes primary docs and pins them before code.
- Concrete employee roles remain out of the initial implementation. Keep a compatible authorization seam, but add role tables/policy only after a real second-role requirement is authorized.
- The concrete internal principal-assertion mechanism across the Service Binding; it must be verifiable, short-lived, audience-bound, and rechecked against current Domain authorization.
- Exact cursor/page/date-range limits, token and confirmation TTLs, audit retention, and alert thresholds; select them from security constraints and staging measurements, then encode them in contract/tests.
- The backup artifact-store adapter and production backing resource; ordinary MCP output is never the artifact transport, and provisioning requires separate authority.
- Disposition of ambiguous legacy debt/payment/customer/history records; migration tooling reports them, but cutover waits for explicit reviewed decisions rather than guessing.
- Exact Worker/service/route/database/KV/bucket names and identifiers; resolve from authorized production metadata in Phase 9.

## Validation

- Plan/document validation: confirm exactly one new active plan exists for this work, its Status is authoritative, it reflects all confirmed Shared Understanding decisions, `git status --short` identifies every tracked/untracked change, the complete untracked plan is read and reviewed rather than relying on `git diff`, and no unrelated file changed.
- During implementation, require focused domain tests for line totals, integer money, discounts, shipping, cost, profit, partial payments, outstanding balances, payment reversal versus actual refund, over-refund, duplicate refund, refund-after-reversal, reversal-after-refund, concurrent refund/reversal, paid-order cancellation guards, legal/illegal order transitions, draft discard/restore, customer snapshots, duplicate warnings, merge/unmerge behavior, archive/restore, template snapshots/defaults, timezone boundaries, and report definitions.
- Require machine-checkable contract validation for both frontend and MCP consumer artifacts and actual serialized provider success/error/empty/null/conflict responses.
- Require Worker/API tests for public/private separation, absence of cost/admin fields from every public product serialization/cache/projection, protected admin catalog access, unknown resources, GitHub-backed OAuth discovery and token validation, immutable owner allowlist, capped legacy-session operations, every MCP scope boundary, masked order/customer projections, PII-gated detail and sensitive-read audit, rate limits, CORS/origin/host checks, confirmation-token binding, idempotency, optimistic conflicts, and bounded pagination.
- Require D1/repository integration tests for constraints, transactions, concurrent retry behavior, immutable payment/refund/reversal history, audit/idempotency atomicity, maintenance fencing, inactive-generation restore, atomic active-generation switch, fault injection, migration application, forward compatibility, and rollback/recovery using isolated non-production databases.
- Require migration/backup/restore rehearsal evidence: source snapshot and dataset-generation identifiers, allowlisted/excluded backup sections, artifact and grant state transitions, abort/revoke/expiry/orphan/retention cleanup, payload-deletion verification with retained redacted manifest, record counts by entity, stable-ID mappings, referential-integrity results, monetary reconciliation by defined metric, checksums, exception inventory/disposition, write-fence behavior, active-generation visibility, fault injection, and rollback rehearsal.
- Require MCP conformance/acceptance through current MCP Inspector and an actual Pi session: authentication, tool discovery, representative read/write workflows, cost-safe public catalog, masked order/customer results, PII-denied and PII-approved details, pagination, duplicate retry, conflict, preview expiration, draft discard/restore, payment/refund/cancellation sequence, artifact upload/download grants, logical restore preview/confirm, and actionable error handling.
- Require frontend acceptance for public storefront, login/session expiry, admin catalog workflows, customer/order/payment workflows, reports, settings/templates, offline/stale behavior, and compatibility mode during migration.
- Always run repository-required npm run test:worker when Worker/auth/CORS/data contracts change, npx tsc --noEmit, and npm run build; add and run repository-native domain, contract, migration, MCP, and end-to-end test commands created by the work.
- At cutover rehearsal and production cutover, prove every legacy whole-key POST for all ten current public/private keys is rejected with `MIGRATION_READ_ONLY` before enabling the first D1-served business write; preserve compatibility reads only, and never silently translate a revisionless bulk write into normalized D1 mutations.
- Before any Cloudflare deployment, require a current Wrangler dry run with reviewed generated types/config/bindings and no secret values. Before any production cutover, require explicit user authorization, backup/recovery evidence, migration rehearsal, acceptance pass, and documented rollback triggers.
- After any eventual cutover, verify only authorized synthetic/status behavior without exposing live customer/order data; a plan checkbox, metadata update, or Continuity checkpoint alone is never completion evidence.

### Plan-authoring evidence — 2026-09-03

- Fixed repository point: `HEAD 0bc4f48ad7b28096813c93219d137bdd867205cf`; `master` was one commit ahead of `origin/master` before this work.
- `git status --short --branch` showed only this untracked execution-plan file; no product code, configuration, dependency, deployment, or external state changed.
- `rg -n '^Active$' docs/plans` equivalent inspection found this plan as the sole Status `Active`; `docs/plans/active/secure-worker-clean-ai-studio.md` remains Status `Completed` and was not repurposed.
- The complete plan and applicable repository authority were read. Independent read-only review passes exposed and then drove corrections for public `costPrice` leakage, legacy-session privilege expansion, all-key raw-write cutover, paid-order cancellation/refund arithmetic, draft deletion mapping, PII-bearing order/backup projections, artifact lifecycle, atomic restore, and premature RBAC.
- TypeScript, build, and Worker suites were not run because this change creates documentation only and changes no executable source or contract. No implementation or runtime-success claim is made from this evidence.

## Definition Of Done

The outcome is complete only when all of the following are true and recorded with executable or observable evidence in this document:

- One authoritative contract governs actual REST, Service Binding, frontend, and MCP boundary behavior; generated/derived artifacts show no drift.
- The Domain/API Worker is the sole authoritative business writer, all business rules execute through `GiabanApplication`, and the MCP Worker has no direct business storage binding.
- Every approved tool family is present, bounded, schema-valid, scope-enforced, audited, and proven through public MCP behavior; no infrastructure or generic raw-storage tool exists.
- Public product/API/KV/cache responses contain no cost or other admin-only field; legacy sessions cannot invoke new MCP-only or sensitive operations; order/customer PII detail and backup export are independently authorized and audited.
- Draft discard remains recoverable; payment/refund/reversal arithmetic prevents double consumption and paid-order cancellation cannot orphan collected cash; refund records never claim to execute external transfers; backup import/export/restore proves its allowlist, state machine, expiry/revocation/cleanup, private transfer grants, and atomic logical-generation recovery boundary.
- Pi completes the real GitHub-backed OAuth flow and representative read, ordinary write, PII detail, conflict, idempotent retry, preview/confirm, reversal, pagination, and error-recovery scenarios.
- Frontend business workflows use the same contract and backend rules, admin writes fail closed, local cache is never authoritative, and the shopper cart remains functional.
- D1 constraints, transactions, revisions, idempotency, confirmation consumption, audit, financial immutability, and report calculations pass focused and integration proof.
- The legacy migration is deterministic; references, counts, defined monetary metrics, and manifests reconcile; every blocking exception is explicitly resolved; both pre-write rollback and post-write recovery paths have been rehearsed.
- Production rollout and later compatibility removal, if authorized, satisfy their recorded gates; every public/private legacy whole-key writer is disabled before any D1 business write and absent before MCP mutation is considered fully enabled.
- Repository-required checks and every newly documented mandatory suite pass on the final repository state; failed or required-skipped checks keep Status Active.
- The Result section records deployed/non-deployed state, exact evidence, residual risks, recovery targets, and any intentionally deferred non-goal. A Continuity checkpoint or plan checkbox alone is insufficient.

## Result

Architecture specification, selected topology, domain/safety contracts, migration/recovery strategy, phase gates, validation matrix, and handoff instructions are recorded in this active plan. Implementation, environment provisioning, deployment, and production migration remain pending and unauthorized by this documentation task.
