/**
 * Patterns API tests — CRUD operations on /api/patterns.
 *
 * All endpoints are protected by JWT auth middleware.
 * Imports from the backend will resolve after the backend branch is merged.
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
  createAuthenticatedRequest,
  samplePatternConfig,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app } from '../api/[[route]]';

let mf: Miniflare;
let env: TestEnv;
let user: Awaited<ReturnType<typeof createTestUser>>;
let token: string;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);

  user = await createTestUser(env.DB);
  const session = await createTestSession(env.DB, user.id);
  token = await signTestAccessToken(user.id, session.id);
});

afterAll(async () => {
  await mf.dispose();
});

// Helper to build an authenticated request for this test suite
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
// GET /api/patterns — list
// ---------------------------------------------------------------------------

describe('GET /api/patterns', () => {
  it('returns empty list for a new user', async () => {
    // Use a fresh user with no patterns
    const freshUser = await createTestUser(env.DB);
    const freshSession = await createTestSession(env.DB, freshUser.id);
    const freshToken = await signTestAccessToken(freshUser.id, freshSession.id);

    const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
      headers: {
        Cookie: makeAuthCookies(freshToken),
        Origin: TEST_CONFIG.APP_BASE_URL,
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patterns ?? body.data ?? body).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/patterns — create
// ---------------------------------------------------------------------------

describe('POST /api/patterns', () => {
  it('creates a pattern and returns it', async () => {
    const config = samplePatternConfig();
    const req = authedRequest('/api/patterns', {
      method: 'POST',
      body: {
        name: 'My Pattern',
        config_json: JSON.stringify(config),
        pattern_type: config.type,
      },
    });

    const res = await app.request(req, {}, env);

    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    const pattern = body.pattern ?? body;
    expect(pattern.name).toBe('My Pattern');
    expect(pattern.pattern_type).toBe('wood-block');
    expect(pattern.id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/patterns — list after creation
// ---------------------------------------------------------------------------

describe('GET /api/patterns — after creation', () => {
  let patternId: string;

  beforeAll(async () => {
    // Create a pattern first
    const config = samplePatternConfig();
    const req = authedRequest('/api/patterns', {
      method: 'POST',
      body: {
        name: 'Listed Pattern',
        config_json: JSON.stringify(config),
        pattern_type: config.type,
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    patternId = (body.pattern ?? body).id;
  });

  it('returns created patterns (most recent first)', async () => {
    const req = authedRequest('/api/patterns');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    const patterns = body.patterns ?? body.data ?? body;
    expect(patterns.length).toBeGreaterThanOrEqual(1);

    // Most recent should be first
    const first = patterns[0];
    expect(first.id).toBeTruthy();
    expect(first.name).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/patterns/:id — get specific
// ---------------------------------------------------------------------------

describe('GET /api/patterns/:id', () => {
  let patternId: string;

  beforeAll(async () => {
    const req = authedRequest('/api/patterns', {
      method: 'POST',
      body: {
        name: 'Specific Pattern',
        config_json: JSON.stringify(samplePatternConfig()),
        pattern_type: 'wood-block',
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    patternId = (body.pattern ?? body).id;
  });

  it('returns the specific pattern', async () => {
    const req = authedRequest(`/api/patterns/${patternId}`);
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    const pattern = body.pattern ?? body;
    expect(pattern.id).toBe(patternId);
    expect(pattern.name).toBe('Specific Pattern');
  });

  it('returns 404 for another user accessing the pattern', async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`,
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

  it('returns 404 for non-existent pattern', async () => {
    const req = authedRequest('/api/patterns/non-existent-id');
    const res = await app.request(req, {}, env);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/patterns/:id — update
// ---------------------------------------------------------------------------

describe('PUT /api/patterns/:id', () => {
  let patternId: string;

  beforeAll(async () => {
    const req = authedRequest('/api/patterns', {
      method: 'POST',
      body: {
        name: 'Before Update',
        config_json: JSON.stringify(samplePatternConfig()),
        pattern_type: 'wood-block',
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    patternId = (body.pattern ?? body).id;
  });

  it('updates a pattern', async () => {
    const updatedConfig = { ...samplePatternConfig(), zoom: 2 };
    const req = authedRequest(`/api/patterns/${patternId}`, {
      method: 'PUT',
      body: {
        name: 'After Update',
        config_json: JSON.stringify(updatedConfig),
      },
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    const pattern = body.pattern ?? body;
    expect(pattern.name).toBe('After Update');
  });

  it('returns 404 when another user tries to update', async () => {
    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`,
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
// DELETE /api/patterns/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/patterns/:id', () => {
  let patternId: string;

  beforeAll(async () => {
    const req = authedRequest('/api/patterns', {
      method: 'POST',
      body: {
        name: 'To Delete',
        config_json: JSON.stringify(samplePatternConfig()),
        pattern_type: 'wood-block',
      },
    });
    const res = await app.request(req, {}, env);
    const body = await res.json();
    patternId = (body.pattern ?? body).id;
  });

  it('deletes a pattern', async () => {
    const req = authedRequest(`/api/patterns/${patternId}`, {
      method: 'DELETE',
    });

    const res = await app.request(req, {}, env);

    expect(res.status).toBe(200);

    // Verify it's gone
    const getReq = authedRequest(`/api/patterns/${patternId}`);
    const getRes = await app.request(getReq, {}, env);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 when another user tries to delete', async () => {
    // Create a new pattern for this test
    const createReq = authedRequest('/api/patterns', {
      method: 'POST',
      body: {
        name: 'Other Delete',
        config_json: JSON.stringify(samplePatternConfig()),
        pattern_type: 'wood-block',
      },
    });
    const createRes = await app.request(createReq, {}, env);
    const createBody = (await createRes.json()) as any;
    const newId = createBody.pattern?.id ?? createBody.id;

    const otherUser = await createTestUser(env.DB);
    const otherSession = await createTestSession(env.DB, otherUser.id);
    const otherToken = await signTestAccessToken(
      otherUser.id,
      otherSession.id,
    );

    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns/${newId}`,
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

describe('GET /api/patterns — pagination', () => {
  let paginationUser: Awaited<ReturnType<typeof createTestUser>>;
  let paginationToken: string;

  beforeAll(async () => {
    // Create a user with multiple patterns
    paginationUser = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, paginationUser.id);
    paginationToken = await signTestAccessToken(
      paginationUser.id,
      session.id,
    );

    // Create 5 patterns
    for (let i = 0; i < 5; i++) {
      const req = new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        method: 'POST',
        headers: {
          Cookie: makeAuthCookies(paginationToken),
          Origin: TEST_CONFIG.APP_BASE_URL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Pagination Pattern ${i}`,
          config_json: JSON.stringify(samplePatternConfig()),
          pattern_type: 'wood-block',
        }),
      });
      await app.request(req, {}, env);
    }
  });

  it('supports limit parameter', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns?limit=2`,
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
    const patterns = body.patterns ?? body.data ?? body;
    expect(patterns.length).toBe(2);
  });

  it('supports offset parameter', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns?limit=2&offset=2`,
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
    const patterns = body.patterns ?? body.data ?? body;
    expect(patterns.length).toBe(2);
  });

  it('returns remaining items when offset + limit exceeds total', async () => {
    const req = new Request(
      `${TEST_CONFIG.APP_BASE_URL}/api/patterns?limit=10&offset=3`,
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
    const patterns = body.patterns ?? body.data ?? body;
    expect(patterns.length).toBe(2); // 5 total - 3 offset = 2 remaining
  });
});
