/**
 * Tests for user profile endpoints:
 * - PATCH /api/me — update nickname
 * - POST /api/me/photo — upload profile photo
 * - GET /api/me/photo — get profile photo
 * - DELETE /api/me/photo — remove profile photo
 * - GET /api/me — returns nickname and photoUrl
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  createAuthenticatedRequest,
  buildTestApiApp,
  type TestEnv,
} from './helpers.js';
import { app as apiApp } from '../api/[[route]].js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mf: Miniflare;
let env: TestEnv;
let userId: string;
let sessionId: string;
let app: Hono;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);
  app = buildTestApiApp(apiApp);

  const user = await createTestUser(env.DB, { name: 'Profile Tester' });
  userId = user.id;

  const session = await createTestSession(env.DB, userId);
  sessionId = session.id;
});

afterAll(async () => {
  await mf.dispose();
});

// ---------------------------------------------------------------------------
// PATCH /api/me
// ---------------------------------------------------------------------------

describe('PATCH /api/me', () => {
  it('should update nickname', async () => {
    const req = await createAuthenticatedRequest('/api/me', {
      method: 'PATCH',
      body: { nickname: 'cool-nick' },
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.nickname).toBe('cool-nick');
  });

  it('should clear nickname when set to empty string', async () => {
    // First set a nickname
    const setReq = await createAuthenticatedRequest('/api/me', {
      method: 'PATCH',
      body: { nickname: 'temp-nick' },
      userId,
      sessionId,
    });
    await app.request(setReq, undefined, env);

    // Then clear it
    const clearReq = await createAuthenticatedRequest('/api/me', {
      method: 'PATCH',
      body: { nickname: '' },
      userId,
      sessionId,
    });

    const res = await app.request(clearReq, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.nickname).toBeFalsy();
  });

  it('should return 401 without auth', async () => {
    const req = new Request('https://test.example.com/api/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://test.example.com',
      },
      body: JSON.stringify({ nickname: 'nope' }),
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/me/photo
// ---------------------------------------------------------------------------

describe('POST /api/me/photo', () => {
  it('should upload a profile photo', async () => {
    const photoBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);

    const req = await createAuthenticatedRequest('/api/me/photo', {
      method: 'POST',
      userId,
      sessionId,
      extraHeaders: { 'Content-Type': 'image/png' },
    });

    // Rebuild request with binary body (createAuthenticatedRequest sets JSON body)
    const photoReq = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: photoBytes,
    });

    const res = await app.request(photoReq, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.photoUrl).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/me/photo
// ---------------------------------------------------------------------------

describe('GET /api/me/photo', () => {
  it('should return uploaded photo', async () => {
    // Upload first
    const photoBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

    const uploadReq = await createAuthenticatedRequest('/api/me/photo', {
      method: 'POST',
      userId,
      sessionId,
      extraHeaders: { 'Content-Type': 'image/png' },
    });
    const uploadReqWithBody = new Request(uploadReq.url, {
      method: 'POST',
      headers: uploadReq.headers,
      body: photoBytes,
    });
    await app.request(uploadReqWithBody, undefined, env);

    // Then fetch
    const getReq = await createAuthenticatedRequest('/api/me/photo', {
      userId,
      sessionId,
    });

    const res = await app.request(getReq, undefined, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/');
  });

  it('should return 404 when no photo exists', async () => {
    // Create a fresh user with no photo
    const freshUser = await createTestUser(env.DB, { name: 'No Photo User' });
    const freshSession = await createTestSession(env.DB, freshUser.id);

    const req = await createAuthenticatedRequest('/api/me/photo', {
      userId: freshUser.id,
      sessionId: freshSession.id,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/me/photo
// ---------------------------------------------------------------------------

describe('DELETE /api/me/photo', () => {
  it('should remove profile photo', async () => {
    // Upload a photo first
    const photoBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const uploadReq = await createAuthenticatedRequest('/api/me/photo', {
      method: 'POST',
      userId,
      sessionId,
      extraHeaders: { 'Content-Type': 'image/png' },
    });
    const uploadReqWithBody = new Request(uploadReq.url, {
      method: 'POST',
      headers: uploadReq.headers,
      body: photoBytes,
    });
    await app.request(uploadReqWithBody, undefined, env);

    // Delete it
    const deleteReq = await createAuthenticatedRequest('/api/me/photo', {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(deleteReq, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('should clear photoUrl from user profile after deletion', async () => {
    const meReq = await createAuthenticatedRequest('/api/me', {
      userId,
      sessionId,
    });

    const res = await app.request(meReq, undefined, env);
    const data = await res.json();
    expect(data.photoUrl).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/me — returns nickname and photoUrl
// ---------------------------------------------------------------------------

describe('GET /api/me (profile fields)', () => {
  it('should include nickname in response', async () => {
    // Set nickname first
    const patchReq = await createAuthenticatedRequest('/api/me', {
      method: 'PATCH',
      body: { nickname: 'test-nick' },
      userId,
      sessionId,
    });
    await app.request(patchReq, undefined, env);

    const getReq = await createAuthenticatedRequest('/api/me', {
      userId,
      sessionId,
    });

    const res = await app.request(getReq, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.id).toBe(userId);
    expect(data.nickname).toBe('test-nick');
    expect(data.name).toBe('Profile Tester');
  });
});
