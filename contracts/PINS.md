# Phase 0 implementation pins

Recorded 2026-09-04 from current official MCP 2026-07-28, Cloudflare Workers/D1/RPC docs, and npm registry versions. These pins apply to local implementation only; production resource IDs remain Phase 9.

## Protocol and contract

- OpenAPI 3.1.0 at `contracts/giaban-api.openapi.yaml` is the sole machine-checkable boundary artifact.
- Local `$ref` values only. Remote `$ref` is forbidden and rejected by contract tests.
- MCP protocol version: `2026-07-28`.
- MCP transport: stateless Streamable HTTP JSON-RPC at `/mcp` (JSON responses; no Durable Object session store).
- Personal MCP authorization: owner-held `KSHT_API_KEY` sent as the `KSHT_API_KEY` header (or the same value as Bearer). GitHub OAuth discovery/token routes are not exposed by this path.

## Packages

- Contract parser: `yaml@2.9.0` (dev).
- Validator/generator set: repository-owned contract tests over the parsed OpenAPI document. No code generator in Phase 0. Types and runtime DTOs are mechanically checked against operation IDs, required fields, enums, and public-product allowlists.
- Wrangler: existing `wrangler@^4.128.0`.
- MCP Worker does not bind `@modelcontextprotocol/sdk` (`1.30.0`) or `@modelcontextprotocol/server` (`2.0.0`) because those packages are not required for a Cloudflare-compatible stateless JSON handler. Tool schemas still follow MCP 2026-07-28.

## Cloudflare runtime

- Domain/API Worker remains `ksht-api` with existing KV `DB` plus a local-only D1 binding `BUSINESS_DB` (placeholder database id; not provisioned).
- MCP Worker config: `wrangler.mcp.jsonc`, provisional name `ksht-mcp`, Service Binding `DOMAIN` → `ksht-api` entrypoint `GiabanDomain`. No D1 and no business KV.
- D1 atomicity: `D1Database.batch()` as one SQL transaction. Isolated tests use `node:sqlite` (`DatabaseSync`) with the same SQL.
- Service Binding RPC: `WorkerEntrypoint` named `GiabanDomain.invoke(envelope)`.
- Compatibility date for new MCP config: `2026-09-04`. Existing API Worker date stays `2025-12-11` until a later authorized runtime bump.

## Internal principal assertion

- Compact HMAC-SHA256 token `gban1.<payload-b64url>.<sig-b64url>`.
- Claims: `iss=giaban-mcp`, `aud=giaban-domain`, `sub` principal id, `githubUserId` (immutable numeric string), `scopes`, `channel`, `jti`, `iat`, `exp`.
- TTL: 60 seconds. Domain Worker verifies signature and clock, then intersects asserted scopes with current direct grants. Caller-supplied actor fields are ignored.
- Shared secret name: `INTERNAL_ASSERTION_SECRET` (never logged). REST legacy sessions do not use this assertion; they map to the capped compatibility allowlist.

## Numeric and time limits

- VND: non-negative `MAX_SAFE_INTEGER` integers.
- Page `limit` default 50, maximum 100.
- Confirmation intent TTL: 10 minutes, single-use, actor/payload/revision bound.
- Idempotency record TTL: 24 hours. Uniqueness `(principalId, operationId, idempotencyKey)`.
- Business timezone: `Asia/Ho_Chi_Minh` for report date boundaries.
- MCP access-token TTL: 8 hours. Refresh is out of scope for the initial owner-only client.

## Backup artifact adapter (local)

- Interface only: manifest + grant metadata in isolated MCP KV; payload bytes behind `ArtifactStore`.
- Production object store (R2 or equivalent) is not created. Local tests use an in-memory artifact store.

## Explicitly not pinned (deferred)

- Production D1/R2 IDs and unrelated secrets. The personal MCP KV binding uses the existing shop namespace only when a separately authorized `ksht-mcp` deploy occurs.
- Employee role tables.
- Alert thresholds.
