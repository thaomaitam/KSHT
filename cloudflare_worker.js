import {
    PRIVATE_DATA_KEYS,
    PUBLIC_READ_KEYS,
    SESSION_TTL_MS,
} from "./workerContract.js";

const PUBLIC_READ_KEY_SET = new Set(PUBLIC_READ_KEYS);
const DATA_KEYS = new Set([...PUBLIC_READ_KEYS, ...PRIVATE_DATA_KEYS]);
const textEncoder = new TextEncoder();

const encodeBase64Url = (bytes) => btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const decodeBase64Url = (value) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

const importSessionKey = (secret) => crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
);

const secretValuesEqual = async (provided, expected) => {
    if (typeof provided !== "string" || typeof expected !== "string") return false;

    const [providedHash, expectedHash] = await Promise.all([
        crypto.subtle.digest("SHA-256", textEncoder.encode(provided)),
        crypto.subtle.digest("SHA-256", textEncoder.encode(expected)),
    ]);

    if (typeof crypto.subtle.timingSafeEqual === "function") {
        return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
    }

    const providedBytes = new Uint8Array(providedHash);
    const expectedBytes = new Uint8Array(expectedHash);
    let difference = 0;
    for (let index = 0; index < providedBytes.length; index += 1) {
        difference |= providedBytes[index] ^ expectedBytes[index];
    }
    return difference === 0;
};

const createSessionToken = async (secret) => {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + SESSION_TTL_MS;
    const payload = encodeBase64Url(textEncoder.encode(JSON.stringify({
        version: 1,
        issuedAt,
        expiresAt,
        nonce: crypto.randomUUID(),
    })));
    const key = await importSessionKey(secret);
    const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));

    return {
        token: `${payload}.${encodeBase64Url(new Uint8Array(signature))}`,
        expiresAt,
    };
};

const verifySessionToken = async (token, secret) => {
    if (!token || !secret) return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    try {
        const [payload, encodedSignature] = parts;
        const key = await importSessionKey(secret);
        const isAuthentic = await crypto.subtle.verify(
            "HMAC",
            key,
            decodeBase64Url(encodedSignature),
            textEncoder.encode(payload),
        );
        if (!isAuthentic) return false;

        const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
        const now = Date.now();
        return claims.version === 1
            && Number.isSafeInteger(claims.issuedAt)
            && Number.isSafeInteger(claims.expiresAt)
            && claims.issuedAt <= now
            && claims.expiresAt > now
            && claims.expiresAt - claims.issuedAt <= SESSION_TTL_MS;
    } catch {
        return false;
    }
};

export default {
    async fetch(request, env, ctx) {
        const origin = request.headers.get("Origin");
        const allowedOrigins = new Set((env.ALLOWED_ORIGINS || "")
            .split(",")
            .map(value => value.trim())
            .filter(Boolean));
        const isAllowedOrigin = origin && allowedOrigins.has(origin);
        const corsHeaders = isAllowedOrigin
            ? {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Admin-Secret",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin",
            }
            : {};

        if (origin && !isAllowedOrigin) {
            return new Response(JSON.stringify({ error: "Origin not allowed" }), {
                status: 403,
                headers: {
                    "Cache-Control": "no-store",
                    "Content-Type": "application/json",
                    "Vary": "Origin",
                    "X-Content-Type-Options": "nosniff",
                },
            });
        }

        if (request.method === "OPTIONS") {
            if (!isAllowedOrigin) {
                return new Response(null, { status: 403 });
            }
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        // Helper for JSON response
        const jsonResponse = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), {
            status,
            headers: {
                "Cache-Control": "no-store",
                "Content-Type": "application/json",
                "X-Content-Type-Options": "nosniff",
                ...corsHeaders,
                ...extraHeaders,
            },
        });

        // Helper for Error response
        const errorResponse = (message, status = 500, headers = {}) => (
            jsonResponse({ error: message }, status, headers)
        );

        // Accept the standard bearer header and the legacy header during frontend rollout.
        const isAuthorized = async () => {
            const authorization = request.headers.get("Authorization");
            const bearerMatch = authorization && authorization.match(/^Bearer\s+(.+)$/i);
            const token = bearerMatch
                ? bearerMatch[1]
                : request.headers.get("X-Admin-Secret");
            return verifySessionToken(token, env.SESSION_SIGNING_SECRET);
        };

        if (request.method === "GET" && path === "/api/status") {
            return jsonResponse({ ok: true });
        }

        // 1. GET /api/data/:key (catalog settings are public; business data is private)
        if (request.method === "GET" && path.startsWith("/api/data/")) {
            const key = path.split("/").pop();
            if (!DATA_KEYS.has(key)) {
                return errorResponse("Not Found", 404);
            }
            if (!PUBLIC_READ_KEY_SET.has(key)) {
                if (!await isAuthorized()) {
                    return errorResponse("Unauthorized", 401);
                }
            }
            const value = await env.DB.get(key);
            return jsonResponse(value ? JSON.parse(value) : null);
        }

        // 2. POST /api/data/:key (Secured with Secret)
        if (request.method === "POST" && path.startsWith("/api/data/")) {
            if (!await isAuthorized()) {
                return errorResponse("Unauthorized", 401);
            }

            const key = path.split("/").pop();
            if (!DATA_KEYS.has(key)) {
                return errorResponse("Not Found", 404);
            }
            try {
                const body = await request.json();
                await env.DB.put(key, JSON.stringify(body));
                return jsonResponse({ success: true });
            } catch (e) {
                return errorResponse("Invalid JSON", 400);
            }
        }

        // 3. POST /api/login
        if (request.method === "POST" && path === "/api/login") {
            const clientKey = request.headers.get("CF-Connecting-IP") || "unknown";
            const rateLimit = await env.LOGIN_RATE_LIMITER.limit({ key: clientKey });
            if (!rateLimit.success) {
                return errorResponse(
                    "Too many login attempts",
                    429,
                    { "Retry-After": "60" },
                );
            }

            try {
                const body = await request.json();
                const { username, password } = body;

                const [usernameMatches, passwordMatches] = await Promise.all([
                    secretValuesEqual(username, env.TK_ADMIN),
                    secretValuesEqual(password, env.MK_ADMIN),
                ]);

                if (usernameMatches && passwordMatches) {
                    const session = await createSessionToken(env.SESSION_SIGNING_SECRET);
                    return jsonResponse({
                        success: true,
                        token: session.token,
                        secret: session.token,
                        expiresAt: session.expiresAt,
                    });
                } else {
                    return errorResponse("Invalid Credentials", 401);
                }
            } catch (e) {
                return errorResponse("Invalid Request Body", 400);
            }
        }

        return errorResponse("Not Found", 404);
    },
};
