import test from 'node:test';
import assert from 'node:assert/strict';

import worker from '../cloudflare_worker.js';

const createEnv = () => {
  const writes = [];
  return {
    ADMIN_SECRET: 'previously-exposed-root-secret',
    SESSION_SIGNING_SECRET: 'new-private-session-signing-secret',
    TK_ADMIN: 'admin',
    MK_ADMIN: 'correct-password',
    ALLOWED_ORIGINS: 'https://giaban.example.test',
    LOGIN_RATE_LIMITER: {
      async limit() {
        return { success: true };
      },
    },
    DB: {
      writes,
      async get(key) {
        return JSON.stringify({ key });
      },
      async put(key, value) {
        writes.push([key, value]);
      },
    },
  };
};

const forgeSessionToken = async (signingSecret, claims = {}) => {
  const payload = Buffer.from(JSON.stringify({
    version: 1,
    issuedAt: Date.now(),
    expiresAt: Date.now() + (60 * 60 * 1000),
    nonce: 'attacker-controlled',
    ...claims,
  })).toString('base64url');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );

  return `${payload}.${Buffer.from(signature).toString('base64url')}`;
};

test('exposes a non-sensitive health endpoint', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/status'),
    createEnv(),
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('rejects unauthenticated reads of sensitive business data', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/orders'),
    createEnv(),
    {},
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorized' });
});

const login = async (env = createEnv()) => {
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'correct-password' }),
    }),
    env,
    {},
  );

  return { response, body: await response.json() };
};

test('rate limits login attempts before checking credentials', async () => {
  const env = createEnv();
  env.LOGIN_RATE_LIMITER.limit = async () => ({ success: false });
  const { response, body } = await login(env);

  assert.equal(response.status, 429);
  assert.deepEqual(body, { error: 'Too many login attempts' });
  assert.equal(response.headers.get('Retry-After'), '60');
});

test('login returns a short-lived session token instead of the root secret', async () => {
  const env = createEnv();
  const { response, body } = await login(env);
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(typeof body.token, 'string');
  assert.equal(body.secret, body.token);
  assert.notEqual(body.token, env.ADMIN_SECRET);
  assert.notEqual(body.token, env.SESSION_SIGNING_SECRET);
  assert.ok(body.expiresAt > Date.now());
});

test('a signed session token authorizes sensitive reads', async () => {
  const env = createEnv();
  const { body } = await login(env);

  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/orders', {
      headers: { Authorization: `Bearer ${body.token}` },
    }),
    env,
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { key: 'orders' });
});

test('rejects unknown KV keys even when authenticated', async () => {
  const env = createEnv();
  const { body } = await login(env);
  const headers = {
    Authorization: `Bearer ${body.token}`,
    'Content-Type': 'application/json',
  };

  const readResponse = await worker.fetch(
    new Request('https://worker.example.test/api/data/unlisted-key', { headers }),
    env,
    {},
  );
  const writeResponse = await worker.fetch(
    new Request('https://worker.example.test/api/data/unlisted-key', {
      method: 'POST',
      headers,
      body: JSON.stringify({ unsafe: true }),
    }),
    env,
    {},
  );

  assert.equal(readResponse.status, 404);
  assert.equal(writeResponse.status, 404);
});

test('CORS preflight mirrors only an explicitly allowed origin', async () => {
  const env = createEnv();
  const allowedResponse = await worker.fetch(
    new Request('https://worker.example.test/api/data/products', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://giaban.example.test',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    }),
    env,
    {},
  );
  const blockedResponse = await worker.fetch(
    new Request('https://worker.example.test/api/data/products', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.test' },
    }),
    env,
    {},
  );

  assert.equal(allowedResponse.status, 204);
  assert.equal(
    allowedResponse.headers.get('Access-Control-Allow-Origin'),
    'https://giaban.example.test',
  );
  assert.equal(allowedResponse.headers.get('Vary'), 'Origin');
  assert.equal(blockedResponse.status, 403);
  assert.equal(blockedResponse.headers.get('Access-Control-Allow-Origin'), null);
});

test('public catalog keys remain readable without authentication', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/products'),
    createEnv(),
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { key: 'products' });
});

test('a browser-exposed root secret cannot forge a session token', async () => {
  const env = createEnv();
  const forgedToken = await forgeSessionToken(env.ADMIN_SECRET);
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/orders', {
      headers: { Authorization: `Bearer ${forgedToken}` },
    }),
    env,
    {},
  );

  assert.equal(response.status, 401);
});

test('rejects an otherwise valid token whose lifetime exceeds the contract', async () => {
  const env = createEnv();
  const overlongToken = await forgeSessionToken(env.SESSION_SIGNING_SECRET, {
    expiresAt: Date.now() + (24 * 60 * 60 * 1000),
  });
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/orders', {
      headers: { Authorization: `Bearer ${overlongToken}` },
    }),
    env,
    {},
  );

  assert.equal(response.status, 401);
});

test('the root secret is never accepted as a browser credential', async () => {
  const env = createEnv();
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/orders', {
      headers: { 'X-Admin-Secret': env.ADMIN_SECRET },
    }),
    env,
    {},
  );

  assert.equal(response.status, 401);
});

test('the legacy header accepts only a signed session token for writes', async () => {
  const env = createEnv();
  const { body } = await login(env);
  const payload = [{ id: 'order-1' }];
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': body.token,
      },
      body: JSON.stringify(payload),
    }),
    env,
    {},
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(env.DB.writes, [['orders', JSON.stringify(payload)]]);
});

test('a tampered session token cannot read sensitive data', async () => {
  const env = createEnv();
  const { body } = await login(env);
  const replacement = body.token.startsWith('a') ? 'b' : 'a';
  const tamperedToken = `${replacement}${body.token.slice(1)}`;
  const response = await worker.fetch(
    new Request('https://worker.example.test/api/data/customers', {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    }),
    env,
    {},
  );

  assert.equal(response.status, 401);
});
