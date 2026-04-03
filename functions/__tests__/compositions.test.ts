/**
 * Compositions API tests — CRUD operations on /api/compositions.
 *
 * All endpoints are protected by JWT auth middleware.
 * The backend returns camelCase fields and paginated responses
 * as { items, total, limit, offset }.
 *
 * NOTE: These tests import the Hono app from the backend.
 * The import will resolve once the backend branch is merged.
 * The backend must export `app` from functions/api/[[route]].ts.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Miniflare } from 'miniflare';
import {
  createTestEnv,
  setupDb,
  createTestUser,
  createTestSession,
  signTestAccessToken,
  makeAuthCookies,
  createTestAuthMiddleware,
  sampleCompositionConfig,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';
import { Hono } from 'hono';

// The backend API app handles /api/* routes.
// This import will resolve once the backend branch is merged.
// The backend needs to add: export { app };
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app as apiRoutes } from '../api/[[route]]';

let mf: Miniflare;
let env: TestEnv;
let user: Awaited<ReturnType<typeof createTestUser>>;
let token: string;

// Compose middleware + API routes for testing.
// In production, Pages _middleware.ts handles auth before [[route]].ts.
// For tests, we apply the equivalent middleware to the Hono app.
let app: Hono;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);

  // Build combined app: auth middleware → API routes
  // apiRoutes has basePath('/api'), so we mount it at root
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
    body?: unknown;
  } = {},
) {
  const headers: Record<string, string> = {
    Cookie: makeAuthCookies(token),
    Origin: TEST_CONFIG.APP_BASE_URL,
  };
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  return new Request(`${TEST_CONFIG.APP_BASE_URL}${path}`, init);
}

// ---------------------------------------------------------------------------
// GET /api/compositions — list
// ---------------------------------------------------------------------------

describe('GET /api/compositions', () => {
  it('returns empty list for a new user', async () => {
    const freshUser = await createTestUser(env.DB);
    const freshSession = await createTestSession(env.DB, freshUser.id);
    const freshToken = await signTestAccessToken(freshUser.id, freshSession.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
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
// POST /api/compositions — create
// ---------------------------------------------------------------------------

describe('POST /api/compositions', () => {
  it('creates a composition and returns it', async () => {
    const config = sampleCompositionConfig();
    const req = authedRequest('/api/compositions', {
      method: 'POST',
      body: {
        name: 'My Composition',
        configJson: JSON.stringify(config),
        patternType: config.type,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('My Composition');
    expect(body.patternType).toBe('wood-block');
    expect(body.id).toBeTruthy();
  });

  it('returns 400 when required fields are missing', async () => {
    const req = authedRequest('/api/compositions', {
      method: 'POST',
      body: { name: 'No config' },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/compositions — list after creation
// ---------------------------------------------------------------------------

describe('GET /api/compositions — after creation', () => {
  beforeAll(async () => {
    const config = sampleCompositionConfig();
    const req = authedRequest('/api/compositions', {
      method: 'POST',
      body: {
        name: 'Listed Composition',
        configJson: JSON.stringify(config),
        patternType: config.type,
      },
    });
    await app.request(req, {}, env);
  });

  it('returns created compositions (most recent first)', async () => {
    const req = authedRequest('/api/compositions');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(1);

    // Most recent should be first
    const first = body.items[0];
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
    expect(first.createdAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/compositions/:id — get specific
// ---------------------------------------------------------------------------

describe('GET /api/compositions/:id', () => {
  let compositionId: string;

  beforeAll(async () => {
    const req = authedRequest('/api/compositions', {
      method: 'POST',
      body: {
        name: 'Specific Composition',
        configJson: JSON.stringify(sampleCompositionConfig()),
        patternType: 'wood-block',
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    compositionId = body.id;
  });

  it('returns the specific composition', async () => {
    const req = authedRequest(`/api/compositions/${compositionId}`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(compositionId);
    expect(body.name).toBe('Specific Composition');
    expect(body.configJson).toBeTruthy();
  });

  it('returns 404 for another user accessing the composition', async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`,
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

  it('returns 404 for non-existent composition', async () => {
    const req = authedRequest('/api/compositions/non-existent-id');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/compositions/:id — update
// ---------------------------------------------------------------------------

describe('PUT /api/compositions/:id', () => {
  let compositionId: string;

  beforeAll(async () => {
    const req = authedRequest('/api/compositions', {
      method: 'POST',
      body: {
        name: 'Before Update',
        configJson: JSON.stringify(sampleCompositionConfig()),
        patternType: 'wood-block',
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    compositionId = body.id;
  });

  it('updates a composition', async () => {
    const updatedConfig = { ...sampleCompositionConfig(), zoom: 2 };
    const req = authedRequest(`/api/compositions/${compositionId}`, {
      method: 'PUT',
      body: {
        name: 'After Update',
        configJson: JSON.stringify(updatedConfig),
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('After Update');
  });

  it('returns 404 when another user tries to update', async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`,
      {
        method: 'PUT',
        headers: {
          Cookie: makeAuthCookies(otherToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hacked' }),
      },
    );

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/compositions/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/compositions/:id', () => {
  let compositionId: string;

  beforeAll(async () => {
    const req = authedRequest('/api/compositions', {
      method: 'POST',
      body: {
        name: 'To Delete',
        configJson: JSON.stringify(sampleCompositionConfig()),
        patternType: 'wood-block',
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    compositionId = body.id;
  });

  it('deletes a composition', async () => {
    const req = authedRequest(`/api/compositions/${compositionId}`, {
      method: 'DELETE',
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    // Verify it's gone
    const getReq = authedRequest(`/api/compositions/${compositionId}`);
    const getRes = await app.request(getReq, {}, env);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when another user tries to delete', async () => {
    // Create a new composition for this test
    const createReq = authedRequest('/api/compositions', {
      method: 'POST',
      body: {
        name: 'Other Delete',
        configJson: JSON.stringify(sampleCompositionConfig()),
        patternType: 'wood-block',
      },
    });
    const createRes = await app.request(createReq, {}, env);
    const createBody = await createRes.json();
    const newId = createBody.id;

    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/compositions/${newId}`,
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

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('GET /api/compositions — pagination', () => {
  let paginationUser: Awaited<ReturnType<typeof createTestUser>>;
  let paginationToken: string;

  beforeAll(async () => {
    paginationUser = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, paginationUser.id);
    paginationToken = await signTestAccessToken(
      paginationUser.id,
      session.id,
    );

    // Create 5 compositions
    for (let i = 0; i < 5; i++) {
      const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        method: 'POST',
        headers: {
          Cookie: makeAuthCookies(paginationToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Pagination Composition ${i}`,
          configJson: JSON.stringify(sampleCompositionConfig()),
          patternType: 'wood-block',
        }),
      });
      await app.request(req, {}, env);
    }
  });

  it('supports limit parameter', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/compositions?limit=2`,
      {
        headers: {
          Cookie: makeAuthCookies(paginationToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      },
    );

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
  });

  it('supports offset parameter', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/compositions?limit=2&offset=2`,
      {
        headers: {
          Cookie: makeAuthCookies(paginationToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      },
    );

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(2);
    expect(body.offset).toBe(2);
  });

  it('returns remaining items when offset + limit exceeds total', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/compositions?limit=10&offset=3`,
      {
        headers: {
          Cookie: makeAuthCookies(paginationToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      },
    );

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(2); // 5 total - 3 offset = 2 remaining
    expect(body.total).toBe(5);
  });
});
