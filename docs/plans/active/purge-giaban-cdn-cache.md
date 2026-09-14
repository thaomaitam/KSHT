<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"a9627617-ef10-4b51-9b15-56a6b5c94a3f","templateVersion":1} -->

# Execution Plan: Purge giaban custom-domain CDN cache

Date: 2026-09-09

## Status

Cancelled — superseded. Custom-domain old SPA was leftover Worker hostname `giaban-khosihuythao`, not Cloudflare HTML cache. Worker deleted; shop is Pages CNAME. See `ARCHITECTURE.md`.

## Outcome

Custom-domain HTML at giaban.khosihuythao.com serves the already-published gh-pages bundle assets/index-BYygNrgr.js so admin shows the new SPA and the two MCP-imported 09/09 orders.

## Authority And Context

- Owner reply "ủy quyền" authorizing the named Cloudflare/Pages cache purge from the prior diagnosis.
- No Worker deploy, no npm run deploy, no KV writes, no MCP catalog/order writes, no whole-key POST restore.
- Frontend origin is GitHub Pages gh-pages 2b9e6b9 bundle index-BYygNrgr.js; custom domain may lag.

## Scope

In scope:

- Identify Cloudflare zone for khosihuythao.com without printing secrets.
- Targeted purge of giaban.khosihuythao.com HTML and hashed JS URLs (hosts purge only if files purge is insufficient).
- Verify HTML script src after purge.

Out of scope:

- Deploying ksht-api, ksht-mcp, or GitHub Pages.
- purge_everything unless files/hosts purge cannot be used.
- Changing Worker secrets, DNS, or KV.
- Clearing phone site data.

## Constraints

- Do not print API tokens, session secrets, or customer PII.
- Do not reopen legacy whole-key POSTs.
- Do not mutate application source.

## Approach

- Confirm wrangler auth without dumping tokens.
- Resolve zone for khosihuythao.com.
- Purge targeted URLs for giaban.khosihuythao.com/ and index.html (and known hashed JS if needed).
- Verify custom-domain HTML references index-BYygNrgr.js.
- If DNS is not Cloudflare-proxied, stop and report CF purge is a no-op.

## Risks And Recovery

- Targeted URL purge can miss cache-key variants; fall back to hosts purge for giaban.khosihuythao.com.
- If grey-cloud DNS, Cloudflare purge does nothing; report that instead of repeating.
- Purge does not delete MCP orders; if HTML still old after successful purge, origin/GitHub cache is the next check.
- Do not purge_everything on first attempt.

## Progress

- [x] Confirm wrangler OAuth login and zone `khosihuythao.com` (active, free).
- [x] Attempt targeted files purge then hosts purge.
- [x] Prove custom-domain GET vs GitHub Pages origin bundle identity.
- [ ] Owner Cache Purge (dashboard or API token with Cache Purge) then re-verify HTML.
- [ ] Record the verified result before finalization.

## Decisions

- Targeted URL purge first; do not `purge_everything` on this attempt.
- Do not deploy Pages/Workers to bust cache; origin already has `index-BYygNrgr.js`.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Custom-domain index.html script src contains index-BYygNrgr.js.
- MCP listOrders still returns the two imported 09/09 orders.
- Report whether files or hosts purge was used and the API success flag without secrets.

## Result

Purge not applied. `POST /zones/{id}/purge_cache` files and hosts both HTTP 401 `10000 Authentication error` using wrangler OAuth (zone read, no Cache Purge). No `CLOUDFLARE_API_TOKEN` in env.

Evidence 2026-09-09:
- `https://giaban.khosihuythao.com/` GET `cf-cache-status: HIT`, script `assets/index-Dlv58Zvm.js`
- `origin/gh-pages` and `https://thaomaitam.github.io/KSHT/` script `assets/index-BYygNrgr.js`
