/**
 * Auth middleware tests.
 *
 * Tests the JWT auth guard that protects all /api/* routes.
 * The middleware verifies __Host-access cookie, checks CSRF Origin header,
 * and sets user context for downstream handlers.
 *
 * Imports from the backend will resolve after the backend branch is merged.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  signTestAccessToken,
  signExpiredAccessToken,
  makeAuthCookies,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

// The API app includes the auth middleware applied to all routes.
// This import will resolve once the backend implementation is merged.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app } from '../api/[[route]]';

let mf: Miniflare;
let env: TestEnv;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);
});

afterAll(async () => {
  await mf.dispose();
});

describe('Auth middleware — cookie validation', () => {
  it('rejects requests without cookies with 401', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/me`, {
      headers: { Origin: TEST_CONFIG.APP_BASE_URL },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('rejects requests with invalid JWT with 401', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/me`, {
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

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/me`, {
      headers: {
        Cookie: makeAuthCookies(expiredToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });

  it('passes through requests with valid JWT and sets user context', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/me`, {
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.id);
    expect(body.email).toBe(user.email);
  });

  it('rejects JWT signed with wrong secret with 401', async () => {
    // Sign with a different secret
    const { SignJWT } = await import('jose');
    const wrongSecret = new TextEncoder().encode('wrong-secret-that-is-long-enough-32ch');
    const badToken = await new SignJWT({ sub: 'user-id', sid: 'session-id' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(wrongSecret);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/me`, {
      headers: {
        Cookie: makeAuthCookies(badToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });
});

describe('Auth middleware — CSRF protection', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let token: string;

  beforeEach(async () => {
    user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    token = await signTestAccessToken(user.id, session.id);
  });

  it('rejects POST without Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'test', config_json: '{}' }),
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });

  it('rejects POST with mismatched Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: 'https://evil.example.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'test', config_json: '{}' }),
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });

  it('allows POST with matching Origin header', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'test-pattern',
        config_json: JSON.stringify({ type: 'wood-block' }),
        pattern_type: 'wood-block',
      }),
    });

    const res = await app.request(req, {}, env);

    // Should not be 403 (CSRF pass). May be 200/201 depending on implementation.
    expect(res.status).not.toBe(403);
  });

  it('allows GET requests without Origin header (safe method)', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/me`, {
      headers: {
        Cookie: makeAuthCookies(token),
      },
    });

    const res = await app.request(req, {}, env);

    // GET is a safe method — CSRF check should not apply
    expect(res.status).toBe(200);
  });

  it('rejects PUT with mismatched Origin header', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns/some-id`,
      {
        method: 'PUT',
        headers: {
          Cookie: makeAuthCookies(token),
          Origin: 'https://evil.example.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'updated' }),
      },
    );

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });

  it('rejects DELETE with mismatched Origin header', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns/some-id`,
      {
        method: 'DELETE',
        headers: {
          Cookie: makeAuthCookies(token),
          Origin: 'https://evil.example.com',
        },
      },
    );

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(403);
  });
});
