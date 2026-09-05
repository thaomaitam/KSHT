<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"f2c37576-c2af-4469-83a0-91b653635ea4","templateVersion":1} -->

# Execution Plan: KSHT production backend and frontend on one KV coordinator

Date: 2026-09-05

## Status

Active

## Outcome

Production ksht-api serves verified-session /api/v1 backed by the same GiabanShop singleton and LiveKvStore used by ksht-mcp. Frontend catalog, orders, payments, reports and settings work against that API with truthful loading/error/session/offline/conflict behavior, private cost display and no whole-key writers. Mandatory tests, production dry runs, reviewed commits, push and ordered deployments with read-only smoke verification complete.

## Authority And Context

- User initially requested implement high-quality KSHT backend+frontend, use Grok 4.6 xhigh subagents, final commit+push+deploy.
- User then accepted proposed scope and explicit production writer cutover and deployment of ksht-api, ksht-mcp and GitHub Pages.
- AGENTS.md and ARCHITECTURE.md establish current KV/MCP topology, auth, privacy, grandfathered historical rows and no concurrent legacy writer.
- workers/api/index.ts currently uses MemoryStore; server/http/ksht.ts selects legacy context on Bearer presence without token verification; both are source-only and must not be deployed as-is.
- Pre-existing untracked .pi/, docs/error.md and docs/plans/active/add-mui-khoet-go-rhino-mcp.md must be preserved and excluded from unrelated commits.
- Older giaban-mcp-domain-platform plan remains historical/current MCP background; this plan owns only the newly authorized shared-writer production cutover and frontend release.

## Scope

In scope:

- Internal authenticated/trusted service path from ksht-api into existing GiabanShop singleton; public MCP endpoint remains owner-key-only.
- Real existing admin-session verification, capped browser operation context, strict CORS, request bounds, JSON errors and fail-closed behavior.
- Hard reject legacy whole-key business writes at cutover, while preserving needed public read/login compatibility; never reopen a competing writer on rollback.
- Frontend API integration for existing catalog/categories, customers/orders/payments, reports, settings/templates; private costs visible only to admin.
- Regression and integration tests including transport auth, public redaction, shared serialization, partial persistence and compatibility/read-only rollback.
- Update architecture/operational evidence, commit task-owned files, push master and deploy ksht-mcp then ksht-api then GitHub Pages only after prerequisite verification.

Out of scope:

- D1 migration, new OAuth, credential rotation, CORS expansion, new product domains, framework/dependency modernization.
- Reconciliation, linking or rewriting historical customer/order/money data; catalog normalization/import.
- Backup import/export/restore exposure, live synthetic financial/customer writes, raw KV rollback or destructive cleanup.
- Changes to Android services, Pi configuration or unrelated untracked files.

## Constraints

- Use existing KV binding and existing GiabanShop owner identity; do not create another authority or reset DO state.
- Verify trusted service channel cannot be reached through public forged headers; never pass MCP key to browser or treat arbitrary Bearer as verified.
- Preserve grandfathered historical reviews, journal, committed mirror, write fences and MCP behavior.
- No secrets or PII in logs/chat/git; use local fixtures and read-only public/auth/status production probes.
- Run npx tsc --noEmit, npm run build, npm run test:worker, npm run test:frontend and npm run test:platform; inspect relevant hooks before execution.
- Delegate separate ownership tasks via harness using Grok 4.6 xhigh; parent reviews diffs and executes authoritative proof.
- Record deployment versions/targets and rollback boundary; no live data rollback. Do not publish Pages before /api/v1 production readiness.

## Approach

- Inspect locked tooling, existing auth/contracts/persistence/frontend behavior and official Workers service-binding APIs; capture baseline tests and final architecture seam.
- Implement and prove backend shared coordinator, trusted /api/v1 transport, real session verification, capped authorization, legacy write fencing and production configs using Grok backend delegate.
- Implement and prove frontend domain-shape correctness, bounded pagination, stable operation state, private cost display, errors/session/offline handling and responsive existing workflows using Grok frontend delegate.
- Independent review and parent integration verification; fix regressions and update architecture plus rollback/readiness procedure.
- Run mandatory suites and Wrangler dry runs; review all tracked and relevant untracked changes; create and push task-scoped commit(s).
- Deploy compatible MCP provider first then ksht-api writer cutover; verify public /api/v1, cost redaction, unauthenticated rejection, legacy write hard fence, MCP read-only status without PII.
- Publish Pages only after backend readiness; verify served artifact, routes and public catalog; record exact commit/deployment evidence and residual limitations.

## Risks And Recovery

- Two writers could corrupt/loss-update KV: both new consumers must reach identical GiabanShop owner queue, legacy POST must hard-fail before new web writes.
- Provider-first rollout must preserve existing MCP and storage layout. If API cutover fails, keep existing storefront available and do not publish Pages.
- Rollback code only to compatible versions that retain legacy write hard fence; never restore old raw KV or old writer lane after accepted new mutations.
- Financial historical blockers remain unrepaired; UI must distinguish unavailable/quarantined data and not synthesize identity or money.
- If deploy times out, inspect named deployment metadata/read-only endpoints before retry. No repeated side effects based solely on failure output.
- If live KV drift/fence appears, stop release and diagnose PII-safe status; no reconciliation or data repair authority.

## Progress

- [x] Implement production /api/v1 edge, HMAC-session verification and internal GIABAN service binding to ksht-mcp#GiabanHttp, preserving the existing owner DO, KV and MCP ingress.
- [x] Fence legacy whole-key POSTs in source and preserve compatibility reads/login; no production deployment yet.
- [x] Integrate frontend domain lifecycle, public/private catalog, backend report summary, cursor page walks, immutable payment UI and loaded settings revisions.
- [x] Add order-history detail-on-demand for invoice/recreate, frozen seller snapshot printing, busy/error handling and retained payment retry keys.
 - [x] Contract/domain/client/KV support for fractional soCuon/soKi with exact unrounded line money, plus Asia/Ho_Chi_Minh report date bounds.
- [x] Finish parent integration review and fresh regression/typecheck/frontend/worker proof on the final state. Native user: platform 113/113, frontend 45/45, tsc exit 0, worker 13/13. Parent vite build 6.4.1: dist/assets/index-BYygNrgr.js 614.09 kB / 160.86 kB gzip (existing >500 kB warning).
- [x] Wrangler 4.128.0 dry runs previously passed for both production configs (bindings unchanged by the money follow-up). Re-run immediately before deploy; do not treat the earlier dry-run as an upload.
- [ ] Commit/push task-owned files, deploy ksht-mcp then ksht-api, smoke-test read-only, then deploy Pages and verify artifact.
- [ ] Record deployment IDs and verified result before finalization.

## Decisions

- Internal service binding is the capability boundary: only the ksht-api Worker derives public/legacyAdmin from actual session verification; no publicly forgeable actor header is accepted. The named GiabanHttp entrypoint reaches the same owner queue as MCP. Current MCP public fetch still serves only authenticated /mcp.
- Keep existing DO storage identity, journal, committed mirror and live KV. No D1, historical reconciliation, secret rotation, live business writes or raw KV rollback in this release.
- Order lists remain masked summaries; printing/recreating explicitly requests invoice detail rather than fetching all PII on list load.
- Cursor pages sort and consume the same descending createdAt/id tuple. Browser page walks are bounded with deduplication and explicit incomplete-state reporting.
 - Shop sells fractional kilograms/rolls. Keep entered soCuon/soKi (at most 3 decimal places) and do not round them to integers.
 - Line, order, payment, receivable and report money keep the exact quantity×price result and are not rounded to whole dong. Catalog unit prices stay non-negative VND. Do not rewrite historical orders; mismatches stay review/quarantine signals.
 - Browser report range uses Asia/Ho_Chi_Minh business dates, matching dayBoundsUtc. Uncertain order/payment retries keep the original idempotency key and payload.
- Refund UI records funds already returned outside the system and requires explicit confirmation; it does not transfer bank funds.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Baseline and final mandatory repo commands with actual pass/fail counts.
- Tests reject missing/invalid/expired sessions and forged internal authority; browser operations remain capped; public data contains no costs or PII.
- Fixture tests show HTTP+MCP share persistence and queue, idempotency/revisions survive restart and journal behavior remains intact.
- Frontend behavioral tests for domain lifecycle, payment balances, list pagination, catalog costs, 401/offline/conflict states and backend report semantics.
- Wrangler dry-run for both production configs using installed compatible executable; inspect bindings and output without secrets.
- Read-only production public /api/v1 and legacy-read smoke, unauthorized and legacy-write rejection where rejection is proven before execution, MCP status/capabilities; verify deployed Pages bundle references expected API.
- Final diff review, task-scoped Git commit ID, remote push evidence, deployment IDs and no PII/secrets exposed.

### Parent verification and recovery log — 2026-09-05

- The failed Grok integration delegate left partial files; user reconciled the parent operation. Worktree was inspected before resuming; unrelated untracked .pi/, docs/error.md and add-mui-khoet-go-rhino-mcp.md remain untouched.
- Parent ran npm run test:frontend: 30/30 PASS and npm run test:worker: 13/13 PASS before later review fixes. These are not final-state evidence for subsequent changes.
- Parent review found empty-item invoices/recreated forms, unhandled order-history actions, pending-payment key reset on order switch, permissive parseInt payment amounts, post-buffer character rather than byte body limits, stale cursor banners, and settings/session error handling gaps. Source fixes and regressions were added; fresh full proof remains required.
- New streamed UTF-8 regression was observed RED via node --experimental-strip-types --test tests/http/production-cutover.test.ts: 9 pass, 1 fail (500 instead of 413). Bounded streaming fix is now in source; GREEN rerun was blocked as an uncertain consequential operation. No GREEN claim.
- Parent npm run build PASS after the review fixes (Vite 6.4.1; 611.11 kB JS, 159.86 kB gzip; existing >500 kB bundle warning). git diff --check PASS before this documentation update. Build does not replace TypeScript validation or behavior tests.
- Subsequent small edits remove persistent admin-cost caching, reject late admin responses after a session change, and add phone-revision/session-expiry regressions. Those edits still need a fresh build/full test run.
- Wrangler 4.128.0 dry runs PASS: npx wrangler deploy --config wrangler.mcp.jsonc --dry-run --keep-vars (160.18 KiB; existing GiabanShop + KV) and npx wrangler deploy --config wrangler.jsonc --dry-run --keep-vars (31.47 KiB; GIABAN=ksht-mcp#GiabanHttp, existing KV/rate limiter/origin). These compiled bundles did not upload or test live RPC execution.
- Harness issue: npm run test:platform and npx tsc --noEmit were blocked as already-determined consequential operations; new test reruns were blocked as uncertain, including child order-actions tests. No alternate quoting/script/wrapper was used to bypass these guards. Native continuity_validate rejected the non-allowlisted commands; its build attempt also reported a changing Git fingerprint. Safety checkpoint authority is unavailable even though the ordinary build later passed.
- Required recovery: user-owned direct Pi ! commands can execute the unchanged mandatory verification entrypoints without treating tests as retryable external effects (installed Continuity README contract). Human reconciliation of uncertain test operations, with actual test outcomes, is still required for safety authority. Do not commit or deploy until final tests/typecheck pass and remaining review is addressed.
 - After later integration fixes, native user executions on the then-current worktree: npm run test:frontend 44/44, npx tsc --noEmit exit 0, npm run test:platform 106/106, npm run test:worker 13/13. Parent continuity_validate npm run build receipt 0fe424f4-28e7-475b-9a8e-62fc7cf9deb7 (Vite 6.4.1; 611.31 kB JS, 159.92 kB gzip; existing >500 kB warning). These are not proof of the later fractional-quantity work.
 - Independent frontend review found integer soCuon/soKi/money incompatible with shop practice, and UTC calendar report dates vs Asia/Ho_Chi_Minh. Owner confirmed fractional kilograms (`có`) and rejected whole-VND rounding (`Tiền thì không cần làm tròn`).
 - Implemented scaled millidong/milli-factor arithmetic: 0.5 kg × 15.001đ = 7.500,5đ; extra decimals rejected; payments may match that exact total. Browser report fromDate/toDate use Asia/Ho_Chi_Minh. Parent npm run test:platform 112/112 PASS after this work (includes domain fractional money, application kilogram draft, OpenAPI factor types, timezone dates). npx tsc --noEmit and npm run test:worker were blocked as already-determined; npm run test:frontend is uncertain (call-ce348f83-f5b2-463e-baef-24c76f454a2a-105). Do not rerun those wrappers; native user ! commands remain the recovery path. No commit/deploy.
 - Native user proof after fractional-kg implementation: npm run test:frontend 44 pass / 1 fail (`payment amounts reject decimals...` accepted `1.5`); npx tsc --noEmit failed on money.ts unknown narrowing (lines 20/23); npm run test:worker 13/13 PASS. Follow-up: payment UI keeps exact decimal dong (`7500.5`) and still rejects junk/`1e3`/non-positive; toScaledInteger narrows number before BigInt/arithmetic. Re-run frontend and tsc required; do not treat the 44/1 or tsc failure as green.
 - Native user rerun after payment-test fix: npm run test:frontend 45/45 PASS. npx tsc --noEmit still failed: fail() did not narrow unknown in money.ts (lines 18/24/27). toScaledInteger now copies a number via typeof before arithmetic so tsc does not depend on never-narrowing. Re-run tsc required; frontend 45/45 is evidence for that suite only.
 - Native user npx tsc --noEmit after typeof-copy: no output, treated as exit 0. Current native proof for fractional-kg worktree: frontend 45/45, tsc exit 0, worker 13/13, parent platform 112/112. Build/Wrangler dry-run still predate this money change and are not final-state evidence. Independent review of the money/quantity/timezone slice is next; no commit/deploy yet.
 - Independent Grok xhigh review (read-only, session 52edafc9): no critical/high. Mediums: reports profit/netReceipts used JS minus; shipping/discount inputs used parseInt; invalid kg coerced to 0đ; catalog variants accept non-integer via assertVnd. Parent applied subtractVnd in reports (including payment validGross) plus Number() shipping/discount, and a domain test 0.5 kg × 15001 with discount 0.5. Left catalog integer split and in-progress 0đ display as residual. Fresh platform/frontend/tsc required; previous 45/45 and 112/112 are not proof of this follow-up. No commit/deploy.
 - Native user after reports/shipping-discount follow-up: npm run test:platform 113/113 PASS (includes report fractional profit/net receipts), npm run test:frontend 45/45 PASS, npx tsc --noEmit no output (exit 0). Worker 13/13 still valid (no worker change). npm run build still lacks a receipt on this follow-up; previous build 0fe424f4 is not proof of this state.

### Ordered rollout and recovery boundary (not yet executed)

1. Review task-only diff plus all new source/tests, both production configs and pinned Wrangler dry runs. Keep pre-existing untracked files out of the commit.
2. Capture named ksht-mcp/ksht-api deployment version metadata without secrets or live customer payloads. Production prerequisites include the existing session signing secret, existing owner DO identity and PII-safe MCP status without external drift. Historical grandfather review counts alone are not a new repair gate.
3. Deploy ksht-mcp with wrangler.mcp.jsonc first (backward-compatible provider); verify /mcp auth remains owner-key-only and public /api/v1 is not exposed there.
4. Deploy ksht-api with wrangler.jsonc (GIABAN binding to GiabanHttp). Verify public catalog/redaction, forbidden origins, missing/invalid sessions, compatibility reads and raw-write fence. Do not exercise live customer/order/payment writes for smoke testing.
5. Only after /api/v1 readiness, run the existing GitHub Pages publication script. Check served asset identity, public catalog and routes. No Cloudflare Pages deployment.
6. Recovery is code-only roll-forward/compatible rollback. Never deploy a prior ksht-api that reopens raw whole-key writes; never restore an old KV document over new commits. If provider/API readiness fails, do not publish Pages. Live drift/partial publish requires the owning journal/reconciliation contract, not guessed repair.

## Result

Pending implementation and executable proof.
