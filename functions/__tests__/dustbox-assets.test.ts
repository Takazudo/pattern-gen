/**
 * Tests for asset dustbox (soft-delete) endpoints:
 * - DELETE /api/assets/:id — soft-delete (set deleted_at)
 * - GET /api/assets — excludes soft-deleted
 * - GET /api/assets/trash — returns only soft-deleted
 * - POST /api/assets/:id/restore — restore from trash
 * - DELETE /api/assets/:id/permanent — permanently delete from D1 + R2
 * - Ownership checks on all operations
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
  createTestAsset,
  softDeleteAsset,
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
let otherUserId: string;
let otherSessionId: string;
let app: Hono;

beforeAll(async () => {
  ({ mf, env } = await createTestEnv());
  await setupDb(env.DB);
  app = buildTestApiApp(apiApp);

  const user = await createTestUser(env.DB, { name: 'Asset Dustbox User' });
  userId = user.id;
  const session = await createTestSession(env.DB, userId);
  sessionId = session.id;

  const otherUser = await createTestUser(env.DB, { name: 'Other Asset User' });
  otherUserId = otherUser.id;
  const otherSession = await createTestSession(env.DB, otherUserId);
  otherSessionId = otherSession.id;
});

afterAll(async () => {
  await mf.dispose();
});

// ---------------------------------------------------------------------------
// DELETE /api/assets/:id — soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /api/assets/:id (soft-delete)', () => {
  it('should soft-delete an asset (set deleted_at)', async () => {
    const asset = await createTestAsset(env, userId, { filename: 'to-soft-delete.png' });

    const req = await createAuthenticatedRequest(`/api/assets/${asset.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify soft-deleted
    const row = await env.DB.prepare('SELECT deleted_at FROM assets WHERE id = ?')
      .bind(asset.id)
      .first<{ deleted_at: number | null }>();
    expect(row).toBeTruthy();
    expect(row!.deleted_at).toBeTruthy();
  });

  it('should return 404 for non-existent asset', async () => {
    const req = await createAuthenticatedRequest('/api/assets/nonexistent', {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow deleting another user\'s asset', async () => {
    const otherAsset = await createTestAsset(env, otherUserId, { filename: 'other-asset.png' });

    const req = await createAuthenticatedRequest(`/api/assets/${otherAsset.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should keep R2 object intact after soft-delete', async () => {
    const asset = await createTestAsset(env, userId, { filename: 'keep-r2.png' });
    const r2Key = asset.r2_key;

    const req = await createAuthenticatedRequest(`/api/assets/${asset.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });
    await app.request(req, undefined, env);

    // R2 object should still exist
    const r2Obj = await env.FILES.get(r2Key);
    expect(r2Obj).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GET /api/assets — excludes soft-deleted
// ---------------------------------------------------------------------------

describe('GET /api/assets (excludes soft-deleted)', () => {
  it('should not include soft-deleted assets in listing', async () => {
    const active = await createTestAsset(env, userId, { filename: 'active-asset.png' });
    const toDelete = await createTestAsset(env, userId, { filename: 'will-delete.png' });
    await softDeleteAsset(env, toDelete.id);

    const req = await createAuthenticatedRequest('/api/assets', {
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    const ids = data.items.map((f: { id: string }) => f.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(toDelete.id);
  });
});

// ---------------------------------------------------------------------------
// GET /api/assets/trash — trashed assets only
// ---------------------------------------------------------------------------

describe('GET /api/assets/trash', () => {
  it('should return only soft-deleted assets', async () => {
    const active = await createTestAsset(env, userId, { filename: 'still-active.png' });
    const trashed = await createTestAsset(env, userId, { filename: 'in-trash.png' });
    await softDeleteAsset(env, trashed.id);

    const req = await createAuthenticatedRequest('/api/assets/trash', {
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    const ids = data.items.map((f: { id: string }) => f.id);
    expect(ids).toContain(trashed.id);
    expect(ids).not.toContain(active.id);
  });

  it('should not show other user\'s trashed assets', async () => {
    const otherTrashed = await createTestAsset(env, otherUserId, { filename: 'other-trashed.png' });
    await softDeleteAsset(env, otherTrashed.id);

    const req = await createAuthenticatedRequest('/api/assets/trash', {
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    const ids = data.items.map((f: { id: string }) => f.id);
    expect(ids).not.toContain(otherTrashed.id);
  });
});

// ---------------------------------------------------------------------------
// POST /api/assets/:id/restore — restore from trash
// ---------------------------------------------------------------------------

describe('POST /api/assets/:id/restore', () => {
  it('should restore a soft-deleted asset', async () => {
    const asset = await createTestAsset(env, userId, { filename: 'to-restore.png' });
    await softDeleteAsset(env, asset.id);

    const req = await createAuthenticatedRequest(`/api/assets/${asset.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    // Verify deleted_at is cleared
    const row = await env.DB.prepare('SELECT deleted_at FROM assets WHERE id = ?')
      .bind(asset.id)
      .first<{ deleted_at: number | null }>();
    expect(row!.deleted_at).toBeNull();
  });

  it('should return 404 for non-trashed asset', async () => {
    const active = await createTestAsset(env, userId, { filename: 'not-trashed.png' });

    const req = await createAuthenticatedRequest(`/api/assets/${active.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow restoring another user\'s trashed asset', async () => {
    const otherAsset = await createTestAsset(env, otherUserId, { filename: 'other-restore.png' });
    await softDeleteAsset(env, otherAsset.id);

    const req = await createAuthenticatedRequest(`/api/assets/${otherAsset.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/assets/:id/permanent — permanent delete
// ---------------------------------------------------------------------------

describe('DELETE /api/assets/:id/permanent', () => {
  it('should permanently delete a trashed asset from D1 and R2', async () => {
    const asset = await createTestAsset(env, userId, { filename: 'perm-delete.png' });
    const r2Key = asset.r2_key;
    await softDeleteAsset(env, asset.id);

    const req = await createAuthenticatedRequest(`/api/assets/${asset.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify it's gone from D1
    const row = await env.DB.prepare('SELECT id FROM assets WHERE id = ?')
      .bind(asset.id)
      .first();
    expect(row).toBeNull();

    // Verify it's gone from R2
    const r2Obj = await env.FILES.get(r2Key);
    expect(r2Obj).toBeNull();
  });

  it('should return 404 for non-trashed asset', async () => {
    const active = await createTestAsset(env, userId, { filename: 'active-no-perm.png' });

    const req = await createAuthenticatedRequest(`/api/assets/${active.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow permanently deleting another user\'s asset', async () => {
    const otherAsset = await createTestAsset(env, otherUserId, { filename: 'other-perm.png' });
    await softDeleteAsset(env, otherAsset.id);

    const req = await createAuthenticatedRequest(`/api/assets/${otherAsset.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});
