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
  samplePatternConfig,
  sampleFileData,
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
// Pattern lifecycle
// ---------------------------------------------------------------------------

describe('Full pattern lifecycle', () => {
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
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(listRes1.status).toBe(200);
    const list1 = await listRes1.json();
    expect(list1.items).toEqual([]);
    expect(list1.total).toBe(0);

    // 2. Create pattern
    const config = samplePatternConfig();
    const createRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        method: 'POST',
        headers: headers('POST'),
        body: JSON.stringify({
          name: 'Integration Pattern',
          configJson: JSON.stringify(config),
          patternType: config.type,
        }),
      }),
      {},
      env,
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const patternId = created.id;
    expect(patternId).toBeTruthy();
    expect(created.name).toBe('Integration Pattern');

    // 3. List → should contain the pattern
    const listRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        headers: headers(),
      }),
      {},
      env,
    );
    const list2 = await listRes2.json();
    expect(list2.items.length).toBe(1);
    expect(list2.items[0].id).toBe(patternId);

    // 4. Load specific pattern
    const loadRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(loadRes.status).toBe(200);
    const loaded = await loadRes.json();
    expect(loaded.name).toBe('Integration Pattern');
    expect(loaded.configJson).toBeTruthy();

    // 5. Update pattern
    const updateRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        method: 'PUT',
        headers: headers('PUT'),
        body: JSON.stringify({ name: 'Updated Integration Pattern' }),
      }),
      {},
      env,
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('Updated Integration Pattern');

    // 6. Delete pattern
    const deleteRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        method: 'DELETE',
        headers: headers(),
      }),
      {},
      env,
    );
    expect(deleteRes.status).toBe(200);

    // 7. Verify deleted
    const loadRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(loadRes2.status).toBe(404);

    // 8. List → should be empty again
    const listRes3 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
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
// File lifecycle
// ---------------------------------------------------------------------------

describe('Full file lifecycle', () => {
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
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(listRes1.status).toBe(200);
    const fileList1 = await listRes1.json();
    expect(fileList1.items).toEqual([]);

    // 2. Upload file
    const fileData = sampleFileData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([fileData.content], { type: fileData.contentType }),
      fileData.filename,
    );

    const uploadRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
        method: 'POST',
        headers: baseHeaders,
        body: formData,
      }),
      {},
      env,
    );
    expect(uploadRes.status).toBe(201);
    const uploaded = await uploadRes.json();
    const fileId = uploaded.id;
    expect(fileId).toBeTruthy();
    expect(uploaded.filename).toBe(fileData.filename);

    // 3. List → should contain the file
    const listRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    const fileList2 = await listRes2.json();
    expect(fileList2.items.length).toBe(1);
    expect(fileList2.items[0].id).toBe(fileId);

    // 4. Get file metadata
    const metaRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(metaRes.status).toBe(200);
    const meta = await metaRes.json();
    expect(meta.filename).toBe(fileData.filename);
    expect(meta.contentType).toBe(fileData.contentType);
    expect(meta.sizeBytes).toBeGreaterThan(0);

    // 5. Download file content
    const downloadRes = await app.request(
      new Request(
        `${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}/download`,
        { headers: baseHeaders },
      ),
      {},
      env,
    );
    expect(downloadRes.status).toBe(200);
    const downloaded = new Uint8Array(await downloadRes.arrayBuffer());
    expect(downloaded).toEqual(fileData.content);

    // 6. Delete file
    const deleteRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`, {
        method: 'DELETE',
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(deleteRes.status).toBe(200);

    // 7. Verify deleted
    const metaRes2 = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`, {
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
  it('user A cannot see user B patterns', async () => {
    const userA = await createTestUser(env.DB);
    const sessionA = await createTestSession(env.DB, userA.id);
    const tokenA = await signTestAccessToken(userA.id, sessionA.id);

    const userB = await createTestUser(env.DB);
    const sessionB = await createTestSession(env.DB, userB.id);
    const tokenB = await signTestAccessToken(userB.id, sessionB.id);

    // User A creates a pattern
    const createRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        method: 'POST',
        headers: {
          Cookie: makeAuthCookies(tokenA),
          Origin: TEST_CONFIG.APP_BASE_URL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'A-Only Pattern',
          configJson: JSON.stringify(samplePatternConfig()),
          patternType: 'wood-block',
        }),
      }),
      {},
      env,
    );
    const created = await createRes.json();
    const patternId = created.id;

    // User B tries to access it
    const getRes = await app.request(
      new Request(
        `${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`,
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

    // User B's pattern list should be empty
    const listRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
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

  it('user A cannot see user B files', async () => {
    const userA = await createTestUser(env.DB);
    const sessionA = await createTestSession(env.DB, userA.id);
    const tokenA = await signTestAccessToken(userA.id, sessionA.id);

    const userB = await createTestUser(env.DB);
    const sessionB = await createTestSession(env.DB, userB.id);
    const tokenB = await signTestAccessToken(userB.id, sessionB.id);

    // User A uploads a file
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([new Uint8Array([42])], { type: 'image/png' }),
      'secret.png',
    );

    const uploadRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
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
    const fileId = uploaded.id;

    // User B tries to access it
    const getRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`, {
        headers: {
          Cookie: makeAuthCookies(tokenB),
          Origin: TEST_CONFIG.APP_BASE_URL,
        },
      }),
      {},
      env,
    );
    expect(getRes.status).toBe(404);

    // User B's file list should be empty
    const listRes = await app.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
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
