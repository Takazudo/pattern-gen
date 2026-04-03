/**
 * Integration tests — end-to-end flows across auth + API.
 *
 * Each test simulates a complete user journey through the system.
 * Uses camelCase request/response fields matching the backend API.
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
  sampleCompositionConfig,
  sampleAssetData,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app as apiRoutes } from '../api/[[route]]';

let mf: Miniflare;
let env: TestEnv;
let app: Hono;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);

  app = new Hono();
  app.use('/api/*', createTestAuthMiddleware());
  app.route('/', apiRoutes);
});

afterAll(async () => {
  await mf.dispose();
});

// ---------------------------------------------------------------------------
// Composition lifecycle
// ---------------------------------------------------------------------------

describe('Full composition lifecycle', () => {
  it('create → list → load → update → delete', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const headers = (method?: string) => {
      const h: Record<string, string> = {
        Cookie: makeAuthCookies(token),
        Origin: TEST_CONFIG.APP_BASE_URL,
      };
      if (method === 'POST' || method === 'PUT') {
        h['Content-Type'] = 'application/json';
      }
      return h;
    };

    // 1. Verify empty list
    const listRes1 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(listRes1.status).toBe(200);
    const list1 = await listRes1.json();
    expect(list1.items).toEqual([]);
    expect(list1.total).toBe(0);

    // 2. Create composition
    const config = sampleCompositionConfig();
    const createRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        method: 'POST',
        headers: headers('POST'),
        body: JSON.stringify({
          name: 'Integration Composition',
          configJson: JSON.stringify(config),
          patternType: config.type,
        }),
      }),
      {},
      env,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const compositionId = created.id;
    expect(compositionId).toBeTruthy();
    expect(created.name).toBe('Integration Composition');

    // 3. List → should contain the composition
    const listRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        headers: headers(),
      }),
      {},
      env,
    );
    const list2 = await listRes2.json();
    expect(list2.items.length).toBe(1);
    expect(list2.items[0].id).toBe(compositionId);

    // 4. Load specific composition
    const loadRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(loadRes.status).toBe(200);
    const loaded = await loadRes.json();
    expect(loaded.name).toBe('Integration Composition');
    expect(loaded.configJson).toBeTruthy();

    // 5. Update composition
    const updateRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`, {
        method: 'PUT',
        headers: headers('PUT'),
        body: JSON.stringify({ name: 'Updated Integration Composition' }),
      }),
      {},
      env,
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('Updated Integration Composition');

    // 6. Delete composition
    const deleteRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`, {
        method: 'DELETE',
        headers: headers(),
      }),
      {},
      env,
    );
    expect(deleteRes.status).toBe(200);

    // 7. Verify deleted
    const loadRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(loadRes2.status).toBe(404);

    // 8. List → should be empty again
    const listRes3 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        headers: headers(),
      }),
      {},
      env,
    );
    const list3 = await listRes3.json();
    expect(list3.items).toEqual([]);
    expect(list3.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Asset lifecycle
// ---------------------------------------------------------------------------

describe('Full asset lifecycle', () => {
  it('upload → list → metadata → download → delete', async () => {
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const baseHeaders: Record<string, string> = {
      Cookie: makeAuthCookies(token),
      Origin: TEST_CONFIG.APP_BASE_URL,
    };

    // 1. Verify empty list
    const listRes1 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(listRes1.status).toBe(200);
    const assetList1 = await listRes1.json();
    expect(assetList1.items).toEqual([]);

    // 2. Upload asset
    const assetData = sampleAssetData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([assetData.content], { type: assetData.contentType }),
      assetData.filename,
    );

    const uploadRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
        method: 'POST',
        headers: baseHeaders,
        body: formData,
      }),
      {},
      env,
    );
    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();
    const assetId = uploaded.id;
    expect(assetId).toBeTruthy();
    expect(uploaded.filename).toBe(assetData.filename);

    // 3. List → should contain the asset
    const listRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    const assetList2 = await listRes2.json();
    expect(assetList2.items.length).toBe(1);
    expect(assetList2.items[0].id).toBe(assetId);

    // 4. Get asset metadata
    const metaRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(metaRes.status).toBe(200);
    const meta = await metaRes.json();
    expect(meta.filename).toBe(assetData.filename);
    expect(meta.contentType).toBe(assetData.contentType);
    expect(meta.sizeBytes).toBeGreaterThan(0);

    // 5. Download asset content
    const downloadRes = await app.request(
      new Request(
        `${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}/download`,
        { headers: baseHeaders },
      ),
      {},
      env,
    );
    expect(downloadRes.status).toBe(200);
    const downloaded = new Uint8Array(await downloadRes.arrayBuffer());
    expect(downloaded).toEqual(assetData.content);

    // 6. Delete asset
    const deleteRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(deleteRes.status).toBe(200);

    // 7. Verify deleted
    const metaRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(metaRes2.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Cross-user isolation
// ---------------------------------------------------------------------------

describe('Cross-user isolation', () => {
  it('user A cannot see user B compositions', async () => {
    const userA = await createTestUser(env.DB);
    const sessionA = await createTestSession(env.DB, userA.id);
    const tokenA = await signTestAccessToken(userA.id, sessionA.id);

    const userB = await createTestUser(env.DB);
    const sessionB = await createTestSession(env.DB, userB.id);
    const tokenB = await signTestAccessToken(userB.id, sessionB.id);

    // User A creates a composition
    const createRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        method: 'POST',
        headers: {
          Cookie: makeAuthCookies(tokenA),
          Origin: TEST_CONFIG.APP_BASE_URL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'A-Only Composition',
          configJson: JSON.stringify(sampleCompositionConfig()),
          patternType: 'wood-block',
        }),
      }),
      {},
      env,
    );
    const created = await createRes.json();
    const compositionId = created.id;

    // User B tries to access it
    const getRes = await app.request(
      new Request(
        `${TEST_CONFIG.APP_BASE_URL}/api/compositions/${compositionId}`,
        {
          headers: {
            Cookie: makeAuthCookies(tokenB),
            Origin: TEST_CONFIG.APP_BASE_URL,
          },
        },
      ),
      {},
      env,
    );
    expect(getRes.status).toBe(404);

    // User B's composition list should be empty
    const listRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/compositions`, {
        headers: {
          Cookie: makeAuthCookies(tokenB),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      }),
      {},
      env,
    );
    const list = await listRes.json();
    expect(list.items).toEqual([]);
  });

  it('user A cannot see user B assets', async () => {
    const userA = await createTestUser(env.DB);
    const sessionA = await createTestSession(env.DB, userA.id);
    const tokenA = await signTestAccessToken(userA.id, sessionA.id);

    const userB = await createTestUser(env.DB);
    const sessionB = await createTestSession(env.DB, userB.id);
    const tokenB = await signTestAccessToken(userB.id, sessionB.id);

    // User A uploads an asset
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array([42])], { type: 'image/png' }),
      'secret.png',
    );

    const uploadRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
        method: 'POST',
        headers: {
          Cookie: makeAuthCookies(tokenA),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
        body: formData,
      }),
      {},
      env,
    );
    const uploaded = await uploadRes.json();
    const assetId = uploaded.id;

    // User B tries to access it
    const getRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets/${assetId}`, {
        headers: {
          Cookie: makeAuthCookies(tokenB),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      }),
      {},
      env,
    );
    expect(getRes.status).toBe(404);

    // User B's asset list should be empty
    const listRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/assets`, {
        headers: {
          Cookie: makeAuthCookies(tokenB),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      }),
      {},
      env,
    );
    const list = await listRes.json();
    expect(list.items).toEqual([]);
  });
});
