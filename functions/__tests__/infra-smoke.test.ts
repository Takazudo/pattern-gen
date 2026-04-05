/**
 * Smoke test for the test infrastructure itself.
 * Verifies that Miniflare D1, R2, and jose JWT signing all work correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  signTestAccessToken,
  signExpiredAccessToken,
  makeAuthCookies,
  hashToken,
  createAuthenticatedRequest,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';
import * as jose from 'jose';

let mf: Miniflare;
let env: TestEnv;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);
});

afterAll(async () => {
  await mf.dispose();
});

describe('D1 database', () => {
  it('creates tables via migration', async () => {
    // Tables should exist after setupDb
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all();

    const tableNames = result.results.map((r: any) => r.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('compositions');
    expect(tableNames).toContain('assets');
  });

  it('supports CRUD operations', async () => {
    const user = await createTestUser(env.DB, { name: 'Smoke User' });
    expect(user.id).toBeTruthy();

    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(user.id)
      .first();
    expect(row).toBeTruthy();
    expect((row as any).name).toBe('Smoke User');
  });
});

describe('R2 bucket', () => {
  it('supports put and get', async () => {
    const content = new Uint8Array([1, 2, 3, 4, 5]);
    await env.FILES.put('smoke-test-key', content);

    const obj = await env.FILES.get('smoke-test-key');
    expect(obj).toBeTruthy();

    const retrieved = new Uint8Array(await obj!.arrayBuffer());
    expect(retrieved).toEqual(content);
  });

  it('supports delete', async () => {
    await env.FILES.put('delete-me', new Uint8Array([99]));
    await env.FILES.delete('delete-me');

    const obj = await env.FILES.get('delete-me');
    expect(obj).toBeNull();
  });

  it('supports list', async () => {
    await env.FILES.put('list-test/a', new Uint8Array([1]));
    await env.FILES.put('list-test/b', new Uint8Array([2]));

    const listing = await env.FILES.list({ prefix: 'list-test/' });
    expect(listing.objects.length).toBe(2);
  });
});

describe('JWT signing', () => {
  it('signs and verifies a valid access token', async () => {
    const token = await signTestAccessToken('user-1', 'session-1');
    expect(token).toBeTruthy();

    const secret = new TextEncoder().encode(TEST_CONFIG.APP_JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    expect(payload.sub).toBe('user-1');
    expect(payload.sid).toBe('session-1');
  });

  it('creates expired tokens that fail verification', async () => {
    const token = await signExpiredAccessToken('user-1', 'session-1');

    const secret = new TextEncoder().encode(TEST_CONFIG.APP_JWT_SECRET);
    await expect(jose.jwtVerify(token, secret)).rejects.toThrow();
  });
});

describe('Cookie helpers', () => {
  it('formats access cookie correctly', () => {
    const cookies = makeAuthCookies('my-jwt-token');
    expect(cookies).toBe('__Host-access=my-jwt-token');
  });

  it('formats access + refresh cookies correctly', () => {
    const cookies = makeAuthCookies('my-jwt', 'my-refresh');
    expect(cookies).toBe('__Host-access=my-jwt; __Host-refresh=my-refresh');
  });
});

describe('Session helpers', () => {
  it('creates a session with hashed refresh token', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);

    expect(session.id).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.refresh_token_hash).toBeTruthy();

    // Verify hash matches the token
    const expectedHash = await hashToken(session.refreshToken);
    expect(session.refresh_token_hash).toBe(expectedHash);

    // Verify stored in D1
    const row = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(session.id)
      .first();
    expect(row).toBeTruthy();
    expect((row as any).user_id).toBe(user.id);
  });
});

describe('Authenticated request builder', () => {
  it('creates a request with auth cookies and origin', async () => {
    const req = await createAuthenticatedRequest('/api/test', {
      userId: 'u1',
      sessionId: 's1',
    });

    expect(req.url).toBe(`${TEST_CONFIG.APP_BASE_URL}/api/test`);
    expect(req.headers.get('Cookie')).toContain('__Host-access=');
    expect(req.headers.get('Origin')).toBe(TEST_CONFIG.APP_BASE_URL);
    expect(req.method).toBe('GET');
  });

  it('supports POST with JSON body', async () => {
    const req = await createAuthenticatedRequest('/api/data', {
      method: 'POST',
      body: { key: 'value' },
    });

    expect(req.method).toBe('POST');
    expect(req.headers.get('Content-Type')).toBe('application/json');
    const body = await req.json();
    expect(body).toEqual({ key: 'value' });
  });
});
