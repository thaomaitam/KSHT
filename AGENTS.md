# Repository Instructions

These instructions apply to the entire repository.

## Project

- The frontend is a Vite + React + TypeScript static application.
- `cloudflare_worker.js` is the Cloudflare Worker/KV backend.
- `public/CNAME` and the GitHub Pages deployment scripts are production-related assets.

## Working Rules

- Preserve unrelated changes and make the smallest coherent change.
- Treat authentication, `localStorage` credentials, CORS, Worker bindings, and customer/order data as security-sensitive.
- Do not expose secrets or inspect live customer data when repository evidence is sufficient.
- Do not deploy, publish, push, rewrite Git history, or modify live Cloudflare resources unless explicitly requested.
- For non-trivial or multi-session work, follow the managed Continuity workflow and keep its repository execution plan authoritative.

## Verification

- Install dependencies with `npm install` when needed.
- Run `npx tsc --noEmit` for TypeScript validation.
- Run `npm run build` for production-build validation.
- Report failed or skipped checks explicitly; do not claim completion without executable evidence.
