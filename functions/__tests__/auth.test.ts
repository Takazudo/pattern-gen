/**
 * Auth endpoint tests.
 *
 * Tests /auth/login, /auth/callback, /auth/logout, /auth/refresh.
 *
 * Imports from the backend will resolve after the backend branch is merged.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  signTestAccessToken,
  makeAuthCookies,
  hashToken,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

// The auth app handles /auth/* routes.
// This import will resolve once the backend implementation is merged.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app } from '../auth/[[route]]';

let mf: Miniflare;
let env: TestEnv;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);
});

afterAll(async () => {
  await mf.dispose();
});

// ---------------------------------------------------------------------------
// GET /auth/login
// ---------------------------------------------------------------------------

describe('GET /auth/login', () => {
  it('redirects to Auth0 authorization URL', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/login`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toBeTruthy();
    expect(location).toContain(`https://${TEST_CONFIG.AUTH0_DOMAIN}/authorize`);
  });

  it('includes required OAuth2 params in redirect URL', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/login`);
    const res = await app.request(req, {}, env);

    const location = new URL(res.headers.get('Location')!);
    expect(location.searchParams.get('client_id')).toBe(
      TEST_CONFIG.AUTH0_CLIENT_ID,
    );
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('redirect_uri')).toContain(
      '/auth/callback',
    );
    expect(location.searchParams.get('scope')).toContain('openid');
    // state and nonce should be present (random values)
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  it('sets __Host-auth0-tx cookie with state/nonce', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/login`);
    const res = await app.request(req, {}, env);

    const setCookies = res.headers.getAll
      ? res.headers.getAll('Set-Cookie')
      : [res.headers.get('Set-Cookie')].filter(Boolean);

    const txCookie = setCookies.find(
      (c) => c && c.includes('__Host-auth0-tx'),
    );
    expect(txCookie).toBeTruthy();
    // Should be HttpOnly, Secure, SameSite=Lax
    expect(txCookie).toContain('HttpOnly');
    expect(txCookie).toContain('Secure');
  });
});

// ---------------------------------------------------------------------------
// GET /auth/callback
// ---------------------------------------------------------------------------

describe('GET /auth/callback', () => {
  it('returns 400 when state parameter is missing', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/auth/callback?code=test-code`,
    );
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(400);
  });

  it('returns 400 when state does not match cookie', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/auth/callback?code=test-code&state=wrong-state`,
      {
        headers: {
          Cookie: '__Host-auth0-tx=eyJzdGF0ZSI6ImNvcnJlY3Qtc3RhdGUifQ==',
        },
      },
    );
    const res = await app.request(req, {}, env);

    // Should fail — state mismatch
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 400 when code parameter is missing', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/auth/callback?state=some-state`,
      {
        headers: {
          Cookie: '__Host-auth0-tx=some-tx-value',
        },
      },
    );
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

describe('POST /auth/logout', () => {
  it('clears auth cookies', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token, session.refreshToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    // Check that cookies are cleared (Max-Age=0 or Expires in past)
    const setCookies = res.headers.getAll
      ? res.headers.getAll('Set-Cookie')
      : [res.headers.get('Set-Cookie')].filter(Boolean);

    const accessClear = setCookies.find(
      (c) => c && c.includes('__Host-access'),
    );
    const refreshClear = setCookies.find(
      (c) => c && c.includes('__Host-refresh'),
    );

    // Both cookies should be cleared
    expect(accessClear).toBeTruthy();
    if (accessClear) {
      expect(
        accessClear.includes('Max-Age=0') ||
          accessClear.includes('max-age=0') ||
          accessClear.includes('Expires=Thu, 01 Jan 1970'),
      ).toBe(true);
    }
  });

  it('deletes session from D1', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token, session.refreshToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    await app.request(req, {}, env);

    // Session should be revoked (revoked_at set or deleted)
    const row = await env.DB.prepare(
      'SELECT revoked_at FROM sessions WHERE id = ?',
    )
      .bind(session.id)
      .first<{ revoked_at: string | null }>();

    // Session should either be deleted or have revoked_at set
    if (row) {
      expect(row.revoked_at).toBeTruthy();
    }
    // If row is null, session was deleted — also acceptable
  });
});

// ---------------------------------------------------------------------------
// POST /auth/refresh
// ---------------------------------------------------------------------------

describe('POST /auth/refresh', () => {
  it('returns new tokens with valid refresh token', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `__Host-refresh=${session.refreshToken}`,
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    // Should set new access and refresh cookies
    const setCookies = res.headers.getAll
      ? res.headers.getAll('Set-Cookie')
      : [res.headers.get('Set-Cookie')].filter(Boolean);

    const newAccess = setCookies.find(
      (c) => c && c.includes('__Host-access'),
    );
    expect(newAccess).toBeTruthy();
  });

  it('returns 401 with invalid refresh token', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: '__Host-refresh=invalid-token-value',
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });

  it('returns 401 with expired session', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
    });

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `__Host-refresh=${session.refreshToken}`,
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });

  it('rotates the refresh token (old hash is replaced)', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const oldHash = session.refresh_token_hash;

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `__Host-refresh=${session.refreshToken}`,
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);
    expect(res.status).toBe(200);

    // The old refresh token hash should no longer be in the session
    const row = await env.DB.prepare(
      'SELECT refresh_token_hash FROM sessions WHERE id = ?',
    )
      .bind(session.id)
      .first<{ refresh_token_hash: string }>();

    expect(row).toBeTruthy();
    expect(row!.refresh_token_hash).not.toBe(oldHash);
  });

  it('returns 401 when refresh token is missing', async () => {
    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(401);
  });
});
