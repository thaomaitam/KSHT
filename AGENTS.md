# Repository Instructions

These instructions apply to the entire repository.

## Project

- The frontend is a Vite + React + TypeScript static application.
- `cloudflare_worker.js` is the Cloudflare Worker/KV backend.
- `public/CNAME` and the GitHub Pages deployment scripts are production-related assets.

## Working Rules

- Preserve unrelated changes and make the smallest coherent change.
- Treat authentication, `sessionStorage` session tokens, `localStorage` catalog/API-URL cache, CORS, Worker bindings, and customer/order data as security-sensitive.
- Do not expose secrets or inspect live customer data when repository evidence is sufficient.
- Do not deploy, publish, push, rewrite Git history, or modify live Cloudflare resources unless explicitly requested.
- For non-trivial or multi-session work, follow the managed Continuity workflow and keep its repository execution plan authoritative.
- Treat a plan file's Status section as authority, not the `docs/plans/active/` folder name. `docs/plans/active/secure-worker-clean-ai-studio.md` is Status Completed.

## Verification

- Install dependencies with `npm install` when needed.
- Run `npx tsc --noEmit` for TypeScript validation.
- Run `npm run build` for production-build validation.
- Run `npm run test:worker` when changing `cloudflare_worker.js`, `workerContract.js`, or Worker auth/CORS/data-key behavior.
- Report failed or skipped checks explicitly; do not claim completion without executable evidence.
