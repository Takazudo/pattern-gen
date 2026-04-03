/**
 * Auth middleware tests.
 *
 * Tests the JWT auth guard + CSRF origin checking that protects /api/* routes.
 * Uses the test auth middleware from helpers (mirrors the real _middleware.ts).
 *
 * The middleware:
 * - Checks __Host-access cookie for a valid HS256 JWT
 * - Verifies the session exists and is not revoked/expired
 * - Rejects mutating requests (POST/PUT/DELETE) without matching Origin header
 * - Sets auth context (userId, sessionId) for downstream handlers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  signTestAccessToken,
  signExpiredAccessToken,
  makeAuthCookies,
  createTestAuthMiddleware,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

let mf: Miniflare;
let env: TestEnv;

/**
 * Create a minimal Hono app with auth middleware + a test endpoint.
 * This mirrors how _middleware.ts protects /api/* routes.
 */
function createTestApp() {
  const app = new Hono();
  app.use('*', createTestAuthMiddleware());
  app.get('/me', (c) => {
    const auth = c.get('auth') as { userId: string; sessionId: string };
    return c.json({ userId: auth.userId, sessionId: auth.sessionId });
  });
  app.post('/data', (c) => {
    return c.json({ ok: true });
  });
  app.put('/data/:id', (c) => {
    return c.json({ ok: true });
  });
  app.delete('/data/:id', (c) => {
    return c.json({ ok: true });
  });
  return app;
}

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);
});

afterAll(async () => {
  await mf.dispose();
});

describe('Auth middleware — cookie validation', () => {
  const app = createTestApp();

  it('rejects requests without cookies with 401', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: { Origin: TEST_CONFIG.APP_BASE_URL },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('rejects requests with invalid JWT with 401', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: {
        Cookie: makeAuthCookies('not-a-valid-jwt'),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });

  it('rejects requests with expired JWT with 401', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const expiredToken = await signExpiredAccessToken(user.id, session.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: {
        Cookie: makeAuthCookies(expiredToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });

  it('passes through requests with valid JWT and sets auth context', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe(user.id);
    expect(body.sessionId).toBe(session.id);
  });

  it('rejects JWT signed with wrong secret with 401', async () => {
    const wrongSecret = new TextEncoder().encode(
      'wrong-secret-that-is-long-enough-32ch',
    );
    const { SignJWT } = await import('jose');
    const badToken = await new SignJWT({ sub: 'user-id', sid: 'session-id' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(wrongSecret);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: {
        Cookie: makeAuthCookies(badToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });

  it('rejects JWT with valid signature but revoked session', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    // Revoke the session
    await env.DB.prepare(
      'UPDATE sessions SET revoked_at = ?1 WHERE id = ?2',
    )
      .bind(Date.now(), session.id)
      .run();

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });
});

describe('Auth middleware — CSRF protection', () => {
  const app = createTestApp();
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let token: string;

  beforeEach(async () => {
    user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    token = await signTestAccessToken(user.id, session.id);
  });

  it('rejects POST without Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/data`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'value' }),
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });

  it('rejects POST with mismatched Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/data`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'value' }),
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });

  it('allows POST with matching Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/data`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'value' }),
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('allows GET requests without Origin header (safe method)', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/me`, {
      headers: {
        Cookie: makeAuthCookies(token),
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
  });

  it('rejects PUT with mismatched Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/data/123`, {
      method: 'PUT',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'updated' }),
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });

  it('rejects DELETE with mismatched Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/data/123`, {
      method: 'DELETE',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: 'https://evil.example.com',
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });
});
