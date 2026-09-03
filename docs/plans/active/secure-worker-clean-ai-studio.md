<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"8cefbae0-b36a-44d7-878a-dc95d77c1569","templateVersion":1} -->

# Execution Plan: Secure Worker and clean legacy AI Studio residue

Date: 2026-09-03

## Status

Completed

## Outcome

The Cloudflare Worker no longer exposes sensitive KV data or a reusable root admin secret to unauthenticated browser clients; the verified security patch is applied to the intended Worker, Google AI Studio residue and confirmed dead code are removed, repository checks pass, and the authorized changes are captured in scoped Git commits on `origin/master`.

## Authority And Context

- User explicitly requested: patch Worker security first, then clean Google AI Studio residue and dead code, and commit the authorized work.
- User follow-up authorized `git push` of `master` and completion of this plan. GitHub Pages deploy and extra Cloudflare changes remain unauthorized.
- User explicitly requested Cloudflare login via an approval URL before implementation.
- Repository AGENTS.md identifies cloudflare_worker.js as the Worker/KV backend and treats authentication, localStorage credentials, CORS, bindings, and customer/order data as security-sensitive.
- Static repository evidence shows unauthenticated GET access to arbitrary KV keys, login returning env.ADMIN_SECRET, and the frontend storing that secret in localStorage. The live deployment must be identified and compared without retrieving customer data.

## Scope

In scope:

- Start Wrangler OAuth and provide the user the approval URL; verify identity with wrangler whoami after approval.
- Inspect only Cloudflare account/Worker metadata and configuration needed to identify the intended deployed Worker and KV binding; do not read live customer/order/KV values.
- Design and implement a minimal security patch across cloudflare_worker.js and the frontend authentication/API client as required.
- Add repository-native Worker configuration or tests only when needed for reproducible validation/deployment, without embedding secret values or destructive resource changes.
- Run local checks and a Wrangler dry run before any production deployment.
- Deploy the verified security patch to the intended existing Worker and verify authorization behavior without exposing live data.
- Remove confirmed Google AI Studio residue, missing index.css reference, stale data.json initialization, and confirmed dead code/UI controls.
- Update README and package scripts/documentation needed to reflect the actual Vite + Cloudflare architecture.
- Create scoped Git commit(s) for the authorized changes.
- Push `origin/master` after the user explicitly authorized that follow-up.

Out of scope:

- Reading or exporting live customer, order, transaction, bank, credential, or KV values.
- Changing or deleting Cloudflare accounts, zones, domains, KV namespaces, unrelated Workers, routes, or other live resources.
- Pull request creation, Git history rewrite, force operations, GitHub Pages deployment, or unrelated refactoring.
- Deleting public/images/01.jpg unless repository/runtime evidence proves it is not referenced by deployed data.
- Large source-tree relocation or framework migration.

## Constraints

- Never print, log, copy, or commit Cloudflare OAuth tokens, Worker secrets, credentials, or live business data.
- Use the exact user-approved Cloudflare account and existing Worker target; stop if target identity is ambiguous.
- Prefer a recoverable deployment path and record the prior Worker version identifier before deployment when available.
- Do not treat CORS as authentication; sensitive data routes require server-side authorization.
- Do not return env.ADMIN_SECRET or another reusable root credential to browser JavaScript.
- Preserve unrelated work and include the existing user-authorized AGENTS.md without overwriting its intent.
- Use the repository verification commands npx tsc --noEmit and npm run build; add focused security regression proof where practical.
- Commit only after executable verification. Push `origin/master` only after explicit follow-up authorization.

## Approach

- Authenticate Wrangler through the user-approved OAuth flow and verify the active Cloudflare identity.
- Inspect Worker/account metadata and repository deployment state; identify the intended Worker and binding without reading KV values.
- Establish the smallest compatible authentication and public-data contract, including public-key allowlisting and protection for business data.
- Implement focused regression tests or an executable Worker test harness, then patch Worker and frontend authentication/API behavior.
- Run TypeScript, Worker-focused tests, production build, and Wrangler deploy --dry-run; review the diff and security invariants.
- Record the existing deployed Worker version, deploy the security patch to the identified Worker, and verify only status/authorization behavior.
- Remove confirmed AI Studio residue, stale data.json initialization, dead imports/state/exports, and nonfunctional controls; rewrite the README and add appropriate quality scripts.
- Run the full repository verification suite, review final diffs/untracked files, and create scoped local commit(s) using the repository commit workflow.

## Risks And Recovery

- Authentication changes can lock out administration. Preserve a rollback path to the prior Worker version and validate login plus authorized write behavior before considering rollout healthy.
- Changing GET authorization can break storefront reads. Keep an explicit allowlist for genuinely public catalog/settings keys and test storefront fetches.
- Cross-origin session design may be affected by browser cookie policy. Prefer a design compatible with the actual frontend/Worker origins and test it before deployment; do not fall back to exposing root secrets.
- Live target ambiguity could modify the wrong Worker. Stop before deployment if account, Worker name, route, or KV binding cannot be proven from metadata.
- Removing fallback/sample behavior can alter offline UX. Keep behavioral cleanup separate and verify storefront/admin routes after changes.
- If deployment verification fails, rollback to the recorded prior Worker version and report the failed evidence; do not continue to cleanup as though security were complete.

## Progress

- [x] Authenticate Wrangler through the user-approved device OAuth flow and verify the active account.
- [x] Inspect and identify the intended Worker, bindings, deployed version, and recovery target without reading KV values.
- [x] Implement, test, dry-run, deploy, and verify the Worker security patch.
- [x] Remove confirmed AI Studio residue and dead code, then run repository verification.
- [x] Review and create scoped local commit(s) without push.
- [x] Push `origin/master` after explicit follow-up authorization.

## Decisions

- Use repository-pinned Wrangler 4.x so inspection, dry runs, and deployment are reproducible.
- Confirmed `ksht-api` as the intended live target: its workers.dev name matches `apiService.ts`, binding `DB` matches the sole `KSHT_DATA` namespace, and secret binding names match `cloudflare_worker.js`.
- Preserve temporary compatibility for the currently deployed frontend by accepting a signed short-lived session token through both `Authorization: Bearer` and legacy `X-Admin-Secret`; never accept or return the root `ADMIN_SECRET` as a browser credential.
- Public reads are limited to `products`, `categories`, and `settings`; all business, customer, order, financial, and template keys require a valid session token.
- Sign sessions with a new `SESSION_SIGNING_SECRET` that has never been returned to the browser; the previously exposed `ADMIN_SECRET` is neither accepted nor used as a signing key.
- Rate-limit login attempts with a native Cloudflare binding at 10 attempts per source address per 60 seconds; retain constant-time credential comparison.
- Treat `workerContract.js` plus `tests/cloudflare-worker.test.js` as the executable cross-deployment contract for public/private keys, session lifetime, compatibility header, and response behavior.
- Never inspect live KV values; authorization probes may inspect status and fixed error shapes only.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- Wrangler OAuth completes and wrangler whoami confirms the intended account identity without exposing token material.
- 2026-09-03: `npx wrangler whoami` passed after user-approved device OAuth; required Worker/KV write scopes are present.
- 2026-09-03: metadata-only inspection confirmed active Worker `ksht-api`, KV binding `DB`, and secret binding names without reading KV values. Current rollback version: `d7fda599-af6a-46de-822e-77b2afc328ba`.
- 2026-09-03: `npx wrangler routes list` was unavailable in Wrangler 4.128.0; this did not block target identification because the application uses the matching workers.dev URL and Worker metadata matched all repository bindings.
- 2026-09-03: added `SESSION_SIGNING_SECRET` directly through Wrangler without printing or persisting its value. Cloudflare created interim same-code secret-change version `a7b1c498-053d-4419-83e4-e52babf2bcc2`; the original rollback target remains `d7fda599-af6a-46de-822e-77b2afc328ba`.
- 2026-09-03: 13 Worker contract/security tests passed, including rejection of unauthenticated sensitive reads, exposed-root token forgery, overlong/tampered tokens, unknown KV keys, and disallowed CORS origins.
- 2026-09-03: `node node_modules/typescript/bin/tsc --noEmit --pretty false` passed.
- 2026-09-03: `node node_modules/vite/bin/vite.js build --emptyOutDir` passed; known pre-cleanup warnings remain for missing `/index.css` and the 500 kB chunk threshold.
- 2026-09-03: Wrangler dry-run passed with the exact `DB`, `LOGIN_RATE_LIMITER`, and `ALLOWED_ORIGINS` bindings; upload size was 7.94 KiB (2.53 KiB gzip).
- 2026-09-03: `git diff --check` passed before deployment.
- 2026-09-03: deployed security version `d74d3eaf-b280-46ab-9389-32c3050daa62` at 100% to `ksht-api`; metadata confirms the existing `DB` namespace, all four secret names, allowed origin, login rate limiter, and compatibility date `2025-12-11`.
- 2026-09-03: status-only live probes passed without reading KV data: `/api/status` returned 200, unauthenticated `/api/data/orders` returned 401, allowed-origin preflight returned 204, disallowed origin returned 403, and invalid login returned 401.
- 2026-09-03: local security commit `aeaf1e8` created; no frontend deployment was performed.
- Focused automated checks prove public catalog keys remain readable while sensitive keys reject unauthenticated access, invalid credentials fail, and successful login does not return env.ADMIN_SECRET.
- npx tsc --noEmit passes.
- 2026-09-03: `node node_modules/typescript/bin/tsc --noEmit --pretty false --incremental false` passed after cleanup.
- 2026-09-03: `npm run check:unused` passed with no unused local/parameter diagnostics.
- 2026-09-03: `node --test tests/cloudflare-worker.test.js` passed 13/13.
- 2026-09-03: `node node_modules/vite/bin/vite.js build --emptyOutDir` passed without the missing `/index.css` warning; remaining warning is the 500 kB chunk threshold (`dist/assets/index-D3szXL94.js` 589.59 kB / 151.22 kB gzip).
- 2026-09-03: `git diff --check` passed after cleanup.
- wrangler deploy --dry-run passes against explicit repository configuration before deployment.
- Post-deployment probes validate response status and authorization behavior without printing live data.
- git diff --check passed and scoped commits `aeaf1e8` and `536ac3c` were created.
- 2026-09-03: `git push origin master` updated `origin/master` from `c3bebc5` to `536ac3c`. No GitHub Pages or extra Cloudflare deploy was performed.

## Result

Security patch is live on Worker `ksht-api` version `d74d3eaf-b280-46ab-9389-32c3050daa62`, with rollback target `d7fda599-af6a-46de-822e-77b2afc328ba`. Google AI Studio residue, stale `data.json` initialization, unused alias/scripts, nonfunctional filter/chevron controls, and unused business-page state were removed. Local verification passed (`tsc --noEmit`, unused-code check, 13 Worker tests, production build without the missing `/index.css` warning, `git diff --check`). Commits `aeaf1e8` (security) and `536ac3c` (cleanup) are on `origin/master`. No GitHub Pages deploy and no extra Cloudflare resource changes were performed. The production frontend still needs a separate authorized deploy before browsers pick up the session-token client.
