<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"701fa8b8-8e33-4c93-b4d8-a8283d193395","templateVersion":1} -->

# Execution Plan: Storefront catalog cache, admin session cache, unmask list PII

Date: 2026-09-14

## Status

Active

## Outcome

Public storefront serves catalog from per-device cache-aside (TTL 10 minutes ± ~30% jitter) without a 0-product flash when a cache exists; ksht-api caches GET public products/categories (~10 minutes, singleflight, Cache-Control public max-age=600, purge/bypass on catalog write or in-app retry). Admin business history/customers stay in memory for the signed session (no localStorage PII). Authenticated listOrders/listCustomers/getOrder include full name and phone (address remains on detail/invoice). No Redis. User later authorized commit, push origin/master, GitHub Pages (`npm run deploy`), and `ksht-api` Worker deploy. ksht-mcp stays undeployed unless named.

## Authority And Context

- User confirmed Shared Understanding after grill-with-docs: Q1 cache-aside per device + jitter, no Redis; Q2 admin in-session cache; Q3 origin HTTP cache at ksht-api; Q4 TTL 10 minutes ± ~30%. Explicit implement request.
- AGENTS.md / ARCHITECTURE.md: live path browser → ksht-api → GIABAN → GiabanShop singleton; localStorage may cache public catalog not admin writes; private routes Cache-Control no-store; public products omit costPrice; listCustomers currently masks phone; getCustomer/getOrderInvoice are PII.
- Original implement request forbade deploy. User then named commit, push, Pages deploy, and ksht-api deploy. Still do not deploy ksht-mcp, widen CORS, reopen whole-key POST, or add Redis.

## Scope

In scope:

- OpenAPI additive name/phone on authenticated list/getOrder contact projections; keep displayName/phoneMasked; address stays on CustomerDetail/invoice.
- GiabanApplication listCustomers/listOrders/getOrder include name and phone.
- Frontend mapping prefers name/phone; storefront cache-aside envelope with TTL jitter; categories public same mechanism; in-app retry bypasses device cache; no empty-state/0 products while loading if cache empty only.
- ksht-api origin cache for GET /api/v1/public/products and /api/v1/public/categories: TTL ~600s, singleflight, Cache-Control public max-age=600; private routes remain no-store; purge on successful product/category writes through ksht-api; request Cache-Control no-cache bypasses origin cache.
- Admin business data in-memory for the login session; no refetch on BusinessPage remount; force refresh after writes and explicit reload; clear on session end.
- ARCHITECTURE.md: public catalog cache + unmasked admin lists.
- Tests: contract, application, http origin cache, frontend cache-aside/session cache/mapping.

Out of scope:

- Redis, CDN on giaban.khosihuythao.com, CORS changes, whole-key POST, localStorage for orders/customers/costs.
- Deploy ksht-mcp, historical order repair, backup MCP, new pii audit pipeline.
- Caching public settings/bank or admin product costs.

## Constraints

- Public catalog never includes costPrice or customer PII.
- Private /api/v1 except the two public catalog GETs stay Cache-Control no-store.
- Device cache format must ignore legacy raw arrays as fresh (no TTL) but may use them as stale.
- F5 respects device TTL; in-app retry bypasses device and origin cache.
- MCP catalog writes may leave ksht-api origin cache stale until TTL (~10 min) unless a write also hits ksht-api.
- KV one write/s/key; no concurrent web-admin + MCP writes.
- Do not print secrets or live customer PII.

## Approach

- Change contracts/giaban-api.openapi.yaml first: MaskedCustomer and MaskedContactSnapshot add required name and phone; update list descriptions. Align contract tests.
- Red/green: application listCustomers/listOrders/getOrder return name+phone while keeping masked fields and omitting address.
- Red/green: frontend maps list name/phone first; production-cutover and application tests that forbade phone on list are updated.
- Red/green: storageService/settingsService public cache-aside with 10min±30% jitter, source cache vs network vs stale-cache; retry bypass; ProductList does not show keyword-empty while loading.
- Red/green: useAppData paints cache immediately when present; skip network when TTL valid.
- Red/green: ksht-api public catalog GET cache + singleflight + purge on catalog mutation + no-cache bypass; inject store in tests because Node has no caches.default.
- Red/green: useBusinessData session memory cache; clear on SESSION_ENDED_EVENT; force reload after order/customer writes.
- Update ARCHITECTURE.md to match cache and list PII behavior.
- Run npx tsc --noEmit, npm run test:frontend, npm run test:platform (test:worker if Worker/CORS/auth files change).

## Risks And Recovery

- Origin Cache API is colo-local; tests use an injectable Map. Recovery: disable cache helper and restore no-store on public GET.
- MCP writes will not purge ksht-api cache; customers may see old prices up to ~10 min origin + device TTL. Recovery: in-app retry bypasses both device and origin; wait TTL.
- Unmasking lists puts PII on list JSON for any holder of the admin session or owner MCP key (already true via getCustomer/getOrderInvoice). Recovery: revert projection + contract.
- Device cache envelope change: old giaban_products arrays are not treated as fresh.
- Admin session cache can be stale after another device writes. Recovery: explicit reload; cache dies with session.

## Progress

- [x] Implement the approved outcome.
- [x] Run behavior-appropriate and repository-required proof.
- [x] Record the verified result before finalization.
- [ ] Set Status to Ready for completion and finalize in this run unless remaining in-scope delivery is unfinished.

## Decisions

- Origin public-catalog cache is an injectable in-isolate Map (not Cloudflare Cache API); tests pass a per-env store so parallel HTTP tests do not share catalog bodies.
- Device catalog cache is a versioned localStorage envelope `{ v: 1, expiresAt, items }`; legacy raw arrays are stale, never fresh.
- In-app ProductList retry calls loadStorefront(true) and sends Cache-Control no-cache; F5/hash load does not bypass.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Contract test: MaskedCustomer/MaskedContactSnapshot require name and phone; public product schema still excludes costPrice.
- Application: owner/admin list customer/order includes name and phone, not address; public products still no costPrice.
- HTTP: GET public products/categories Cache-Control public max-age=600; second GET does not call GIABAN; catalog write then GET is fresh; Cache-Control no-cache bypasses; /api/v1/orders and other private still no-store; unauthenticated customers 401.
- Frontend: fresh TTL hit does not fetch; expired uses network; failure with cache is stale-cache; no costPrice in public cache; retry fetches; admin remount does not refetch until force/logout.
- npx tsc --noEmit; npm run test:frontend; npm run test:platform; npm run test:worker only if cloudflare_worker.js/workerContract.js/auth-CORS-data-key change.

## Result

Source implemented, not deployed. typecheck passed. Frontend suite 53/53. test:platform 115/115. test:worker skipped: no cloudflare_worker.js / workerContract.js / auth-CORS-data-key change.
