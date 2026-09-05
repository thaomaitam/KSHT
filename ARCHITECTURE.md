# Architecture

Two separately deployed Workers share this repository and the same shop KV. Production `ksht-api` serves `/api/v1` through a named Service Binding to `ksht-mcp#GiabanHttp`. That is not a D1 cutover.

## Live shop (customer-facing)

- Frontend: React 19 + TypeScript + Vite, GitHub Pages, `https://giaban.khosihuythao.com`.
- Last released backend: Worker `ksht-api`, entry `workers/api/index.ts`, config `wrangler.jsonc`. Compatibility reads and login still go through `cloudflare_worker.js` inside that Worker. Legacy whole-key POSTs return 423 `MIGRATION_READ_ONLY` once authenticated; unauthenticated writes fail closed.
- Store: Workers KV binding `DB`.
- Admin auth: time-limited signed session. Browser holds the session in `sessionStorage`. Root admin secrets stay on the Worker; they are never a browser or MCP credential.
- Public reads: products, categories, settings (no cost price).
- Private KV keys (orders, customers, costPrices, …) require that session.
- CORS allowlist is not authentication. `localhost:3000` is not in `ALLOWED_ORIGINS`.

## Personal MCP (owner Pi)

- Worker `ksht-mcp`, config `wrangler.mcp.jsonc`, URL `https://ksht-mcp.ngthanhhuy951.workers.dev/mcp`.
- Auth: Wrangler secret `KSHT_API_KEY`. Client sends header `KSHT_API_KEY` (Bearer with the same value also works). GitHub OAuth is cancelled for this path.
- Runtime: thin Worker fetch + one SQLite Durable Object `GiabanShop` (`idFromName("owner")`). The DO serializes owner requests, journals incomplete multi-key publishes, and keeps a strongly consistent mirror of the last fully published commit.
- Persistence target: the same Workers KV namespace `DB` used by `cloudflare_worker.js`. On first live request, MCP hydrates the ten legacy shop documents; mutations persist a versioned private canonical state and publish only changed legacy-compatible documents.
- Public `products` remain storefront-compatible (`category`, not `categoryId`) and omit `costPrice`; private cost data stays in `costPrices` and canonical state.
- KV allows one write per second per key and has no multi-key transaction. MCP throttles same-key writes and journals roll-forward. Do not write through the web admin concurrently with MCP.
- Initial hydration is read-only. Explicit IDs are preserved. Ambiguous legacy order/customer links, debt, or totals are reported by `getStatus`. Historical `customer_id_requires_review` and `legacy_total_or_debt_requires_review` rows are grandfathered: they stay unrepaired and are not document-fenced; projection must not write synthetic `legacy_customer_*` ids or rewrite those rows. Other blockers and external KV drift still fail closed with `MIGRATION_READ_ONLY`.
- Live `ksht-mcp` keeps `MCP_WRITE_DISABLED=0` and `MCP_RECONCILE_ENABLED=1`. Remaining grandfathered historical reviews keep `migrationReady` false. Do not apply another live repair or delete historical orders without a named request. Do not use web-admin writes concurrently with MCP.
- On restart, the DO commit mirror wins over a potentially stale KV read. If any legacy document differs, MCP keeps the committed view and blocks all writes until KV propagation catches up or an explicit reconciliation handles a real external edit. This prevents rollback or stale overwrite.
- Backup import/export/restore tools are intentionally absent from personal MCP until real artifact validation and live-safe recovery exist.
- Pi config: owner-wide `~/.pi/agent/mcp.json` server `KSHT`, `protocolVersion` `2026-07-28`, header `${KSHT_API_KEY}`. Project `.mcp.json` is optional convenience and is not required. No `npm run mcp:local` for this path.
- MCP tools are business operations only. They must not deploy, bind, or rotate Cloudflare/GitHub resources.

## Shared domain (production)

- Contract: `contracts/giaban-api.openapi.yaml`.
- Application: `server/application/giaban.ts` + `server/domain/`.
- HTTP `/api/v1` adapter exists in source (`server/http/`, `client/giabanClient.ts`). Admin UI in source no longer POSTs `/api/data/:key`.
- Production path: browser → `ksht-api` (`workers/api/index.ts`) → named Service Binding `GIABAN` → `ksht-mcp#GiabanHttp` → the existing `GiabanShop` owner singleton and `LiveKvStore`. `wrangler.domain.jsonc` is a development configuration of the same edge, not a MemoryStore production alternative.
- Released: `ksht-mcp` version `4e60c693-d7b1-448a-88f9-900ad17c47d2`; `ksht-api` version `da19dfe5-eb5f-4d5a-9720-ab49b01f689a`; GitHub Pages `gh-pages` `2b9e6b9` bundle `assets/index-BYygNrgr.js` (contains `ksht-api.ngthanhhuy951.workers.dev`). Custom-domain HTML at `https://giaban.khosihuythao.com` may lag GitHub until CDN cache expires.
- `ksht-api` verifies signed session credentials before deriving the capped public/legacyAdmin actor. The actor travels through internal RPC, not a public identity header. Public MCP fetch remains owner-key-only `/mcp` and rejects public `/api/v1`; it never accepts browser session authority.
- `createOwnerRuntime` owns one queue for both adapters, pending-publish flush and committed-mirror consistency checks. No second writer, D1 migration, fresh DO identity, or `DOMAIN_AUTHORITATIVE` flag is introduced.
- Source legacy whole-key POSTs return 423 `MIGRATION_READ_ONLY`; compatibility public reads and login remain. Public catalog omits costs; private admin products are not persisted in localStorage. Invalid/expired sessions clear private caches and exit private views.
- Cursor consumers and pagination share descending createdAt/id ordering; bounded client walks explicitly report incomplete lists. Order summaries do not supply invoice items: printing/recreating explicitly loads invoice detail and preserves its frozen seller snapshot.
- Release evidence: [production execution plan](docs/plans/active/ksht-production-backend-frontend.md).
- Rollback must preserve the raw-write fence and committed data. Do not restore prior KV over new transactions or roll back to an edge that reopens the legacy writer.

## Data and money rules (both consumers)

- Cloudflare KV is the live business source for this path; the DO is coordination/recovery state. localStorage may cache reads and hold the shopper cart; it is not an admin write source.
- Order total excludes previous debt. Receivables are derived. Payments/refunds/reversals are immutable records. Giaban records refunds; it does not move money at a bank.
- Public product projections omit `costPrice`. `listCustomers` masks phone; `getCustomer` is PII.

## Intentionally not done

- D1 migration or a `DOMAIN_AUTHORITATIVE=1` cutover. The pending KV/shared-DO release replaces the separate Domain Worker proposal.
- GitHub OAuth MCP (cancelled; not a future requirement for this path).
- Routing `/mcp` on `giaban.khosihuythao.com` (that host is Pages).
- Publishing a future frontend before a matching production `/api/v1` Worker.
- Concurrent use of legacy web-admin writes and MCP writes.
