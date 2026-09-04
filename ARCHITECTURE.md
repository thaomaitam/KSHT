# Architecture

Two separately deployed Workers share this repository and, after an explicitly authorized MCP deployment, the same shop KV. Do not treat that binding as a Pages, `/api/v1`, or D1 cutover.

## Live shop (customer-facing)

- Frontend: React 19 + TypeScript + Vite, GitHub Pages, `https://giaban.khosihuythao.com`.
- Backend: Worker `ksht-api`, entry `cloudflare_worker.js`, `wrangler.jsonc`.
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
- Initial hydration is read-only. Explicit IDs are preserved. Ambiguous legacy order/customer links, debt, or totals are reported by `getStatus` and block affected writes with `MIGRATION_READ_ONLY` instead of silently rewriting history.
- On restart, the DO commit mirror wins over a potentially stale KV read. If any legacy document differs, MCP keeps the committed view and blocks all writes until KV propagation catches up or an explicit reconciliation handles a real external edit. This prevents rollback or stale overwrite.
- Backup import/export/restore tools are intentionally absent from personal MCP until real artifact validation and live-safe recovery exist.
- Pi config: project `.mcp.json` server `KSHT`, `protocolVersion` `2026-07-28`, header `${KSHT_API_KEY}`. No `npm run mcp:local` for this path.
- MCP tools are business operations only. They must not deploy, bind, or rotate Cloudflare/GitHub resources.

## Shared domain (source, not live-wired)

- Contract: `contracts/giaban-api.openapi.yaml`.
- Application: `server/application/giaban.ts` + `server/domain/`.
- HTTP `/api/v1` adapter exists in source (`server/http/`, `client/giabanClient.ts`). Admin UI in source no longer POSTs `/api/data/:key`.
- Production `ksht-api` does **not** serve `/api/v1` yet. `DOMAIN_AUTHORITATIVE=1` is not enabled. Pages still runs the previously published bundle and continues reading public catalog documents from KV.
- Local Domain worker `workers/api/index.ts` + `wrangler.domain.jsonc` is not production-wired.

## Data and money rules (both consumers)

- Cloudflare KV is the live business source for this path; the DO is coordination/recovery state. localStorage may cache reads and hold the shopper cart; it is not an admin write source.
- Order total excludes previous debt. Receivables are derived. Payments/refunds/reversals are immutable records. Giaban records refunds; it does not move money at a bank.
- Public product projections omit `costPrice`. `listCustomers` masks phone; `getCustomer` is PII.

## Intentionally not done

- Deployment of the new MCP-to-live-KV binding and first live hydration.
- Production Domain Worker, D1, `DOMAIN_AUTHORITATIVE=1`.
- GitHub OAuth MCP (cancelled; not a future requirement for this path).
- Routing `/mcp` on `giaban.khosihuythao.com` (that host is Pages).
- Publishing the Phase 6 frontend to Pages.
- Concurrent use of legacy web-admin writes and MCP writes.
