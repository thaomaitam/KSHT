# Repository Instructions

These instructions apply to the entire repository.

## Project

- The frontend is a Vite + React + TypeScript static application.
- Live shop backend is `cloudflare_worker.js` (Workers KV). Production `wrangler.jsonc` stays on that path until a named cutover.
- Personal MCP is Worker `ksht-mcp` (`wrangler.mcp.jsonc`, `workers/mcp/index.ts`) plus SQLite Durable Object `GiabanShop`; the target implementation binds it to the live shop KV `DB`.
- `public/CNAME` and GitHub Pages scripts are production frontend assets.
- Current topology, auth, and cutover gates: `ARCHITECTURE.md`.

## Working Rules

- Preserve unrelated changes and make the smallest coherent change.
- Treat authentication, `sessionStorage` session tokens, `localStorage` catalog/API-URL cache, CORS, Worker bindings, customer/order data, and MCP credentials as security-sensitive.
- Do not expose secrets or inspect live customer data when repository evidence is sufficient.
- Do not print, commit, or log `KSHT_API_KEY`, `ADMIN_SECRET` / `MK_ADMIN` / `TK_ADMIN`, or session signing secrets.
- Do not deploy, publish, push, rewrite Git history, or modify live Cloudflare resources unless explicitly requested for that named action and target.
- List/set Worker secrets with `--config wrangler.mcp.jsonc` for MCP; do not use the production `wrangler.jsonc` for MCP deploys.
- For non-trivial or multi-session work, follow the managed Continuity workflow and keep its repository execution plan authoritative.
- Treat a plan file's Status section as authority, not the `docs/plans/active/` folder name. `docs/plans/active/secure-worker-clean-ai-studio.md` is Status Completed.

## Personal MCP (current path)

- Owner-only HTTP MCP at `https://ksht-mcp.ngthanhhuy951.workers.dev/mcp`.
- Auth is header `KSHT_API_KEY` (or `Authorization: Bearer` equal to the same Wrangler secret). GitHub OAuth is not the personal MCP path and must not be required for Pi.
- Never use the admin password / `ADMIN_SECRET` as an MCP credential.
- The same key must exist on the `ksht-mcp` Worker secret and in the Pi client env (`${KSHT_API_KEY}` in `.mcp.json`). A `.bashrc` export does not set Worker secrets and does not apply to already-open Pi sessions.
- MCP source code hydrates the current live shop KV into its versioned domain state and publishes compatible changed documents back to the same KV. `GiabanShop` serializes owner operations and journals partial publishes.
- Do not use admin web writes concurrently with MCP writes; Workers KV has no cross-Worker transaction/CAS and permits only one write per second to a key.
- If legacy orders have missing customer IDs, non-zero legacy debt, or incompatible totals, `getStatus` reports migration blockers and affected customer/order writes fail with `MIGRATION_READ_ONLY`; do not bypass this guard.
- `GiabanShop` keeps a strongly consistent committed mirror so a stale post-restart KV read cannot roll back an accepted write. If legacy KV differs after that commit (stale propagation or an external writer), MCP retains the committed view and blocks writes until KV matches or explicit reconciliation occurs.
- Personal MCP does not expose backup import/export/restore tools until artifact validation and live-safe recovery are implemented.
- The binding in `wrangler.mcp.jsonc` does not authorize deployment. Do not deploy `ksht-mcp` or initialize its live canonical state without a separate named deploy request.
- MCP must not operate Cloudflare, deployments, or secrets.
- `https://giaban.khosihuythao.com/mcp` is GitHub Pages, not an MCP Worker.

## Frontend / live shop

- Source admin/storefront writers use `/api/v1` (`client/giabanClient.ts`). Do not restore whole-key `POST /api/data/:key` writers.
- Production Worker still serves KV whole-key routes. Do not `npm run deploy` Pages until a named `/api/v1` production Worker exists; that deploy would fail-closed for admin writes.
- Do not nới `ALLOWED_ORIGINS`. `localhost:3000` is intentionally absent.

## Verification

- Install dependencies with `npm install` when needed.
- Run `npx tsc --noEmit` for TypeScript validation.
- Run `npm run build` for production-build validation.
- Run `npm run test:worker` when changing `cloudflare_worker.js`, `workerContract.js`, or Worker auth/CORS/data-key behavior.
- Run `npm run test:frontend` when changing admin/storefront write paths.
- Run `npm run test:platform` (or the relevant `test:domain` / `test:application` / `test:contract` / MCP tests) when changing `server/`, `workers/mcp/`, or contracts.
- Report failed or skipped checks explicitly; do not claim completion without executable evidence.
