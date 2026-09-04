import { fail } from "../domain/errors.ts";
import type { Scope } from "../application/registry.ts";

const encoder = new TextEncoder();

export interface Principal {
  principalId: string;
  githubUserId: string;
  scopes: Scope[];
  channel: "rest" | "mcp" | "rpc" | "legacy";
  clientId?: string;
}

export interface InvocationContext extends Principal {
  requestId: string;
  idempotencyKey?: string;
  expectedRevision?: number;
  confirmationToken?: string;
  now: Date;
  legacy?: boolean;
}

interface AssertionClaims {
  iss: string;
  aud: string;
  sub: string;
  githubUserId: string;
  scopes: Scope[];
  channel: Principal["channel"];
  jti: string;
  iat: number;
  exp: number;
  clientId?: string;
}

const importKey = (secret: string, usages: KeyUsage[]) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");

const unb64url = (value: string): Uint8Array => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

export const issueAssertion = async (
  secret: string,
  principal: Principal,
  now = new Date(),
  ttlSeconds = 60,
): Promise<string> => {
  const iat = Math.floor(now.getTime() / 1000);
  const claims: AssertionClaims = {
    iss: "giaban-mcp",
    aud: "giaban-domain",
    sub: principal.principalId,
    githubUserId: principal.githubUserId,
    scopes: principal.scopes,
    channel: principal.channel,
    clientId: principal.clientId,
    jti: crypto.randomUUID(),
    iat,
    exp: iat + ttlSeconds,
  };
  const payload = b64url(encoder.encode(JSON.stringify(claims)));
  const key = await importKey(secret, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `gban1.${payload}.${b64url(signature)}`;
};

export const verifyAssertion = async (
  secret: string,
  token: string,
  now = new Date(),
): Promise<Principal> => {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "gban1") fail("UNAUTHENTICATED", "Invalid internal assertion");
  const key = await importKey(secret, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", key, unb64url(parts[2]), encoder.encode(parts[1]));
  if (!ok) fail("UNAUTHENTICATED", "Invalid internal assertion");
  const claims = JSON.parse(new TextDecoder().decode(unb64url(parts[1]))) as AssertionClaims;
  const nowSec = Math.floor(now.getTime() / 1000);
  if (claims.iss !== "giaban-mcp" || claims.aud !== "giaban-domain") {
    fail("UNAUTHENTICATED", "Assertion audience mismatch");
  }
  if (claims.exp <= nowSec || claims.iat > nowSec) fail("UNAUTHENTICATED", "Assertion expired");
  return {
    principalId: claims.sub,
    githubUserId: claims.githubUserId,
    scopes: claims.scopes,
    channel: claims.channel,
    clientId: claims.clientId,
  };
};
