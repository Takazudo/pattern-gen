/**
 * Assets API tests — upload, list, download, delete via /api/assets.
 *
 * All endpoints are protected by JWT auth middleware.
 * Asset content is stored in R2, metadata in D1.
 * Responses use camelCase fields: contentType, sizeBytes, createdAt.
 *
 * NOTE: Import from the backend resolves after the backend branch is merged.
 * The backend must export `app` from functions/api/[[route]].ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  signTestAccessToken,
  makeAuthCookies,
  createTestAuthMiddleware,
  sampleAssetData,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app as apiRoutes } from '../api/[[route]]';

let mf: Miniflare;
let env: TestEnv;
let user: Awaited<ReturnType<typeof createTestUser>>;
let token: string;
let app: Hono;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);

  app = new Hono();
  app.use('/api/*', createTestAuthMiddleware());
  app.route('/', apiRoutes);

  user = await createTestUser(env.DB);
  const session = await createTestSession(env.DB, user.id);
  token = await signTestAccessToken(user.id, session.id);
});

afterAll(async () => {
  await mf.dispose();
});

function authedRequest(
  path: string,
  options: {
    method?: string;
    body?: BodyInit | null;
    headers?: Record<string, string>;
  } = {},
) {
  const headers: Record<string, string> = {
    Cookie: makeAuthCookies(token),
    Origin: TEST_CONFIG.APP_BASE_URL,
    ...options.headers,
  };
  return new Request(`${TEST_CONFIG.APP_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
  });
}

// ---------------------------------------------------------------------------
// POST /api/assets — upload
// ---------------------------------------------------------------------------

describe('POST /api/assets', () => {
  it('uploads an asset and creates D1 record', async () => {
    const assetData = sampleAssetData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([assetData.content], { type: assetData.contentType }),
      assetData.filename,
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.filename).toBe(assetData.filename);
    expect(body.contentType).toBe(assetData.contentType);
  });
});

// ---------------------------------------------------------------------------
// GET /api/assets — list
// ---------------------------------------------------------------------------

describe('GET /api/assets', () => {
  it('lists assets for the authenticated user', async () => {
    const req = authedRequest('/api/assets');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('returns empty list for a new user with no assets', async () => {
    const freshUser = await createTestUser(env.DB);
    const freshSession = await createTestSession(env.DB, freshUser.id);
    const freshToken = await signTestAccessToken(
      freshUser.id,
      freshSession.id,
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
      headers: {
        Cookie: makeAuthCookies(freshToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/assets/:id — metadata
// ---------------------------------------------------------------------------

describe('GET /api/assets/:id', () => {
  let assetId: string;

  beforeAll(async () => {
    const assetData = sampleAssetData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([assetData.content], { type: assetData.contentType }),
      assetData.filename,
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    assetId = body.id;
  });

  it('returns asset metadata', async () => {
    const req = authedRequest(`/api/assets/${assetId}`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(assetId);
    expect(body.filename).toBeTruthy();
    expect(body.contentType).toBeTruthy();
    expect(body.sizeBytes).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent asset', async () => {
    const req = authedRequest('/api/assets/non-existent-id');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/assets/:id/download — stream content
// ---------------------------------------------------------------------------

describe('GET /api/assets/:id/download', () => {
  let assetId: string;
  const testContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  beforeAll(async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([testContent], { type: 'application/octet-stream' }),
      'download-test.bin',
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    assetId = body.id;
  });

  it('streams asset content from R2', async () => {
    const req = authedRequest(`/api/assets/${assetId}/download`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    const buffer = await res.arrayBuffer();
    const downloaded = new Uint8Array(buffer);
    expect(downloaded).toEqual(testContent);
  });

  it('sets Content-Type and Content-Disposition headers', async () => {
    const req = authedRequest(`/api/assets/${assetId}/download`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBeTruthy();
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/assets/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/assets/:id', () => {
  let assetId: string;

  beforeAll(async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array([10, 20, 30])], {
        type: 'application/octet-stream',
      }),
      'delete-test.bin',
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    assetId = body.id;
  });

  it('deletes asset from R2 and D1', async () => {
    const req = authedRequest(`/api/assets/${assetId}`, { method: 'DELETE' });
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    // Verify it's gone from D1
    const getReq = authedRequest(`/api/assets/${assetId}`);
    const getRes = await app.request(getReq, {}, env);
    expect(getRes.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Ownership isolation
// ---------------------------------------------------------------------------

describe('Asset ownership', () => {
  let assetId: string;

  beforeAll(async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array([99])], { type: 'image/png' }),
      'owned-asset.png',
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    assetId = body.id;
  });

  it("cannot access another user's asset metadata", async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}`,
      {
        headers: {
          Cookie: makeAuthCookies(otherToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      },
    );

    const res = await app.request(req, {}, env);
    expect(res.status).toBe(404);
  });

  it("cannot download another user's asset", async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}/download`,
      {
        headers: {
          Cookie: makeAuthCookies(otherToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      },
    );

    const res = await app.request(req, {}, env);
    expect(res.status).toBe(404);
  });

  it("cannot delete another user's asset", async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}`,
      {
        method: 'DELETE',
        headers: {
          Cookie: makeAuthCookies(otherToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      },
    );

    const res = await app.request(req, {}, env);
    expect(res.status).toBe(404);
  });
});
