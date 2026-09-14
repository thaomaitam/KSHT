<!-- pi-continuity-work-document: {"schemaVersion":1,"kind":"execution-plan","workItemId":"95a3f457-8628-49f8-9ae0-0221764db115","templateVersion":1} -->

# Execution Plan: Deploy GitHub Pages frontend for admin catalog writes

Date: 2026-09-14

## Status

Ready for completion

## Outcome

GitHub Pages origin publishes the current Vite admin SPA so catalog price updates and archive go through /api/v1 instead of fenced whole-key POST /api/data.

## Authority And Context

- User: Hệ thống dùng github page. npm run deploy fix
- AGENTS.md: do not npm run deploy Pages unless explicitly requested for that named frontend; this request names npm run deploy
- ARCHITECTURE.md: production ksht-api already serves /api/v1; Pages frontend is GitHub Pages at giaban.khosihuythao.com
- Diagnosis: custom-domain CDN still serves index-Dlv58Zvm.js which POSTs /api/data/products (423). Origin gh-pages HTML already references index-BYygNrgr.js. Redeploy may still leave Cloudflare HTML cache stale.
- Worktree master 0049f40; frontend source unchanged since cutover commit 9ae21cc; untracked .pi/ and docs files must stay out of the publish.
- Follow-on 2026-09-14: screenshot DNS Type Worker giaban.khosihuythao.com → giaban-khosihuythao. User: tiến hành xoá worker đó tôi sẽ thao tác bước còn lại.

## Scope

In scope:

- Inspect worktree before publish
- npm run deploy (predeploy vite build then gh-pages -d dist) for thaomaitam/KSHT gh-pages
- Verify origin index.html script src after publish
- Report custom-domain CDN lag if HTML/JS still old
- Delete leftover Worker giaban-khosihuythao only. Owner adds GitHub Pages CNAME afterward.

Out of scope:

- ksht-api or ksht-mcp Worker deploy
- Cloudflare cache purge unless a later named request
- Restoring POST /api/data writers
- Widening ALLOWED_ORIGINS
- MCP catalog writes
- Commit to master
- Changing admin UI source
- Deleting ksht-api or ksht-mcp

## Constraints

- Do not print secrets or live customer PII
- Do not reopen whole-key POST writers
- Do not nới CORS
- Do not deploy Workers
- Preserve untracked .pi/ and unrelated docs
- Admin day-to-day remains https://giaban.khosihuythao.com not github.io

## Approach

- Confirm master worktree has no unpublished frontend source changes vs 9ae21cc
- Run npm run deploy from /workspace/code/KSHT
- Verify raw/origin gh-pages index.html hashed JS identity
- Compare custom-domain HTML/JS; do not purge Cloudflare without a named request
- wrangler delete --name giaban-khosihuythao (no --config). Dashboard fallback if auth fails.

## Risks And Recovery

- Cloudflare custom-domain cache can keep index-Dlv58Zvm.js after origin updates; recovery is Custom Purge of giaban.khosihuythao.com, not a second Worker deploy
- If npm run deploy times out, inspect gh-pages branch and origin HTML before retrying; do not assume failure means nothing published
- Rollback is publishing a prior compatible Pages artifact that still uses /api/v1; never restore an edge that reopens whole-key POSTs
- github.io remains CORS-blocked; do not treat it as the shop admin origin

## Progress

- [x] Confirm master frontend unchanged vs 9ae21cc (docs-only 0049f40).
- [x] npm run deploy: Vite 6.4.1 built dist/assets/index-BYygNrgr.js 614.09 kB / 160.86 kB gzip; `gh-pages -d dist` printed Published.
- [x] Origin proof: raw gh-pages index.html script `./assets/index-BYygNrgr.js`; thaomaitam.github.io/KSHT/assets/index-BYygNrgr.js 200.
- [x] Custom-domain check: giaban.khosihuythao.com/assets/index-BYygNrgr.js 404; index-Dlv58Zvm.js 200. No Cloudflare purge in this run.
- [x] Record result. Residual was a Worker hostname, not only CDN.
- [x] wrangler delete --name giaban-khosihuythao --force → Successfully deleted giaban-khosihuythao. ksht-api left in place. Owner remaining: CNAME + GitHub Pages custom domain.
- [x] Owner CNAME `giaban` → `thaomaitam.github.io` (DNS-only). Pages `cname` verified, HTTPS approved.
- [x] Custom domain serves `assets/index-BYygNrgr.js` 200; old `index-Dlv58Zvm.js` 404.
- [x] Owner confirmed `https://giaban.khosihuythao.com` works (2026-09-14).
- [x] Recorded live Pages/CNAME topology in `ARCHITECTURE.md` and `AGENTS.md`.

## Decisions

- Redeploy Pages only; do not reopen whole-key POST or change CORS.
- Identical artifact to the previous gh-pages tree (`2b9e6b9c472f387debc7e9e765c7d7b93f6b597c`, message Updates). Origin was already the /api/v1 SPA.

Promote lasting product or architecture decisions into repository-owned decision documentation only after authority exists.

## Validation

- npm run deploy exits 0
- Origin gh-pages index.html script src is a current hashed Vite bundle containing /api/v1 product PATCH/archive
- No Worker configs or source writers changed
- Report custom-domain bundle identity separately from origin

## Result

`npm run deploy` exited 0 from master `0049f40` (frontend same as `9ae21cc`). Published artifact is still `assets/index-BYygNrgr.js`. `refs/heads/gh-pages` remains `2b9e6b9c472f387debc7e9e765c7d7b93f6b597c` because the tree matched the previous Pages commit.

Origin was already the `/api/v1` SPA. Custom-domain old bundle was leftover Worker hostname `giaban-khosihuythao` (DNS Type Worker, proxied `100::`), not Cloudflare HTML cache. That Worker was deleted. Shop DNS is CNAME `giaban` → `thaomaitam.github.io` (DNS-only). Pages custom domain `giaban.khosihuythao.com` is verified. Owner confirmed the shop loads. Do not recreate the Worker; do not nới CORS for github.io.
