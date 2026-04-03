/**
 * Integration tests — end-to-end flows across auth + API.
 *
 * Each test simulates a complete user journey through the system.
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
  samplePatternConfig,
  sampleFileData,
  type TestEnv,
  TEST_CONFIG,
} from './helpers';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — backend not yet merged
import { app as apiApp } from '../api/[[route]]';

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
// Pattern lifecycle
// ---------------------------------------------------------------------------

describe('Full pattern lifecycle', () => {
  it('create → list → load → update → delete', async () => {
    // 1. Create user and auth
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

    // 2. Verify empty list
    const listRes1 = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(listRes1.status).toBe(200);
    const list1 = await listRes1.json();
    const patterns1 = list1.patterns ?? list1.data ?? list1;
    expect(patterns1).toEqual([]);

    // 3. Create pattern
    const config = samplePatternConfig();
    const createRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        method: 'POST',
        headers: headers('POST'),
        body: JSON.stringify({
          name: 'Integration Pattern',
          config_json: JSON.stringify(config),
          pattern_type: config.type,
        }),
      }),
      {},
      env,
    );
    expect([200, 201]).toContain(createRes.status);
    const created = await createRes.json();
    const patternId = (created.pattern ?? created).id;
    expect(patternId).toBeTruthy();

    // 4. List → should contain the pattern
    const listRes2 = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        headers: headers(),
      }),
      {},
      env,
    );
    const list2 = await listRes2.json();
    const patterns2 = list2.patterns ?? list2.data ?? list2;
    expect(patterns2.length).toBe(1);
    expect(patterns2[0].id).toBe(patternId);

    // 5. Load specific pattern
    const loadRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(loadRes.status).toBe(200);
    const loaded = await loadRes.json();
    expect((loaded.pattern ?? loaded).name).toBe('Integration Pattern');

    // 6. Update pattern
    const updateRes = await apiApp.request(
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
    expect((updated.pattern ?? updated).name).toBe(
      'Updated Integration Pattern',
    );

    // 7. Delete pattern
    const deleteRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        method: 'DELETE',
        headers: headers(),
      }),
      {},
      env,
    );
    expect(deleteRes.status).toBe(200);

    // 8. Verify deleted
    const loadRes2 = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns/${patternId}`, {
        headers: headers(),
      }),
      {},
      env,
    );
    expect(loadRes2.status).toBe(404);

    // 9. List → should be empty again
    const listRes3 = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        headers: headers(),
      }),
      {},
      env,
    );
    const list3 = await listRes3.json();
    const patterns3 = list3.patterns ?? list3.data ?? list3;
    expect(patterns3).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// File lifecycle
// ---------------------------------------------------------------------------

describe('Full file lifecycle', () => {
  it('upload → list → metadata → download → delete', async () => {
    // 1. Create user and auth
    const user = await createTestUser(env.DB);
    const session = await createTestSession(env.DB, user.id);
    const token = await signTestAccessToken(user.id, session.id);

    const baseHeaders: Record<string, string> = {
      Cookie: makeAuthCookies(token),
      Origin: TEST_CONFIG.APP_BASE_URL,
    };

    // 2. Verify empty list
    const listRes1 = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(listRes1.status).toBe(200);
    const fileList1 = await listRes1.json();
    const files1 = fileList1.files ?? fileList1.data ?? fileList1;
    expect(files1).toEqual([]);

    // 3. Upload file
    const fileData = sampleFileData();
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([fileData.content], { type: fileData.contentType }),
      fileData.filename,
    );

    const uploadRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
        method: 'POST',
        headers: baseHeaders,
        body: formData,
      }),
      {},
      env,
    );
    expect([200, 201]).toContain(uploadRes.status);
    const uploaded = await uploadRes.json();
    const fileId = (uploaded.file ?? uploaded).id;
    expect(fileId).toBeTruthy();

    // 4. List → should contain the file
    const listRes2 = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    const fileList2 = await listRes2.json();
    const files2 = fileList2.files ?? fileList2.data ?? fileList2;
    expect(files2.length).toBe(1);
    expect(files2[0].id).toBe(fileId);

    // 5. Get file metadata
    const metaRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`, {
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(metaRes.status).toBe(200);
    const meta = await metaRes.json();
    const fileMeta = meta.file ?? meta;
    expect(fileMeta.filename).toBe(fileData.filename);
    expect(fileMeta.content_type).toBe(fileData.contentType);

    // 6. Download file content
    const downloadRes = await apiApp.request(
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

    // 7. Delete file
    const deleteRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/files/${fileId}`, {
        method: 'DELETE',
        headers: baseHeaders,
      }),
      {},
      env,
    );
    expect(deleteRes.status).toBe(200);

    // 8. Verify deleted
    const metaRes2 = await apiApp.request(
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
    // Create two users
    const userA = await createTestUser(env.DB);
    const sessionA = await createTestSession(env.DB, userA.id);
    const tokenA = await signTestAccessToken(userA.id, sessionA.id);

    const userB = await createTestUser(env.DB);
    const sessionB = await createTestSession(env.DB, userB.id);
    const tokenB = await signTestAccessToken(userB.id, sessionB.id);

    // User A creates a pattern
    const createRes = await apiApp.request(
      new Request(`${TEST_CONFIG.APP_BASE_URL}/api/patterns`, {
        method: 'POST',
        headers: {
          Cookie: makeAuthCookies(tokenA),
          Origin: TEST_CONFIG.APP_BASE_URL,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'A-Only Pattern',
          config_json: JSON.stringify(samplePatternConfig()),
          pattern_type: 'wood-block',
        }),
      }),
      {},
      env,
    );
    const created = await createRes.json();
    const patternId = (created.pattern ?? created).id;

    // User B tries to access it
    const getRes = await apiApp.request(
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
    const listRes = await apiApp.request(
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
    const patterns = list.patterns ?? list.data ?? list;
    expect(patterns).toEqual([]);
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

    const uploadRes = await apiApp.request(
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
    const fileId = (uploaded.file ?? uploaded).id;

    // User B tries to access it
    const getRes = await apiApp.request(
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
    const listRes = await apiApp.request(
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
    const files = list.files ?? list.data ?? list;
    expect(files).toEqual([]);
  });
});
