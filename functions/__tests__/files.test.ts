/**
 * Files API tests — upload, list, download, delete via /api/files.
 *
 * All endpoints are protected by JWT auth middleware.
 * File content is stored in R2, metadata in D1.
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
  sampleFileData,
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
// POST /api/files — upload
// ---------------------------------------------------------------------------

describe('POST /api/files', () => {
  it('uploads a file and creates D1 record', async () => {
    const file = sampleFileData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([file.content], { type: file.contentType }),
      file.filename,
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
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
    expect(body.filename).toBe(file.filename);
    expect(body.contentType).toBe(file.contentType);
  });
});

// ---------------------------------------------------------------------------
// GET /api/files — list
// ---------------------------------------------------------------------------

describe('GET /api/files', () => {
  it('lists files for the authenticated user', async () => {
    const req = authedRequest('/api/files');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it('returns empty list for a new user with no files', async () => {
    const freshUser = await createTestUser(env.DB);
    const freshSession = await createTestSession(env.DB, freshUser.id);
    const freshToken = await signTestAccessToken(
      freshUser.id,
      freshSession.id,
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
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
// GET /api/files/:id — metadata
// ---------------------------------------------------------------------------

describe('GET /api/files/:id', () => {
  let fileId: string;

  beforeAll(async () => {
    const file = sampleFileData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([file.content], { type: file.contentType }),
      file.filename,
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    fileId = body.id;
  });

  it('returns file metadata', async () => {
    const req = authedRequest(`/api/files/${fileId}`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(fileId);
    expect(body.filename).toBeTruthy();
    expect(body.contentType).toBeTruthy();
    expect(body.sizeBytes).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent file', async () => {
    const req = authedRequest('/api/files/non-existent-id');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/files/:id/download — stream content
// ---------------------------------------------------------------------------

describe('GET /api/files/:id/download', () => {
  let fileId: string;
  const testContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  beforeAll(async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([testContent], { type: 'application/octet-stream' }),
      'download-test.bin',
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    fileId = body.id;
  });

  it('streams file content from R2', async () => {
    const req = authedRequest(`/api/files/${fileId}/download`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    const buffer = await res.arrayBuffer();
    const downloaded = new Uint8Array(buffer);
    expect(downloaded).toEqual(testContent);
  });

  it('sets Content-Type and Content-Disposition headers', async () => {
    const req = authedRequest(`/api/files/${fileId}/download`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBeTruthy();
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/files/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/files/:id', () => {
  let fileId: string;

  beforeAll(async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array([10, 20, 30])], {
        type: 'application/octet-stream',
      }),
      'delete-test.bin',
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    fileId = body.id;
  });

  it('deletes file from R2 and D1', async () => {
    const req = authedRequest(`/api/files/${fileId}`, { method: 'DELETE' });
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    // Verify it's gone from D1
    const getReq = authedRequest(`/api/files/${fileId}`);
    const getRes = await app.request(getReq, {}, env);
    expect(getRes.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Ownership isolation
// ---------------------------------------------------------------------------

describe('File ownership', () => {
  let fileId: string;

  beforeAll(async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array([99])], { type: 'image/png' }),
      'owned-file.png',
    );

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
      method: 'POST',
      headers: {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
      body: formData,
    });

    const res = await app.request(req, {}, env);
    const body = await res.json();
    fileId = body.id;
  });

  it("cannot access another user's file metadata", async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`,
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

  it("cannot download another user's file", async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}/download`,
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

  it("cannot delete another user's file", async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`,
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
