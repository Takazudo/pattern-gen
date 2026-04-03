/**
 * Tests for composition dustbox (soft-delete) endpoints:
 * - DELETE /api/compositions/:id — soft-delete (set deleted_at)
 * - GET /api/compositions — excludes soft-deleted
 * - GET /api/compositions/trash — returns only soft-deleted
 * - POST /api/compositions/:id/restore — clear deleted_at
 * - DELETE /api/compositions/:id/permanent — permanently delete
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
  createTestComposition,
  softDeleteComposition,
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

  const user = await createTestUser(env.DB, { name: 'Dustbox User' });
  userId = user.id;
  const session = await createTestSession(env.DB, userId);
  sessionId = session.id;

  const otherUser = await createTestUser(env.DB, { name: 'Other User' });
  otherUserId = otherUser.id;
  const otherSession = await createTestSession(env.DB, otherUserId);
  otherSessionId = otherSession.id;
});

afterAll(async () => {
  await mf.dispose();
});

// ---------------------------------------------------------------------------
// DELETE /api/compositions/:id — soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /api/compositions/:id (soft-delete)', () => {
  it('should soft-delete a composition (set deleted_at)', async () => {
    const composition = await createTestComposition(env, userId, { name: 'To Soft Delete' });

    const req = await createAuthenticatedRequest(`/api/compositions/${composition.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify it's soft-deleted (has deleted_at)
    const row = await env.DB.prepare('SELECT deleted_at FROM compositions WHERE id = ?')
      .bind(composition.id)
      .first<{ deleted_at: number | null }>();
    expect(row).toBeTruthy();
    expect(row!.deleted_at).toBeTruthy();
  });

  it('should return 404 for non-existent composition', async () => {
    const req = await createAuthenticatedRequest('/api/compositions/nonexistent', {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow deleting another user\'s composition', async () => {
    const otherComposition = await createTestComposition(env, otherUserId, { name: 'Other Composition' });

    const req = await createAuthenticatedRequest(`/api/compositions/${otherComposition.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/compositions — excludes soft-deleted
// ---------------------------------------------------------------------------

describe('GET /api/compositions (excludes soft-deleted)', () => {
  it('should not include soft-deleted compositions in listing', async () => {
    const active = await createTestComposition(env, userId, { name: 'Active Composition' });
    const toDelete = await createTestComposition(env, userId, { name: 'Will Be Deleted' });
    await softDeleteComposition(env, toDelete.id);

    const req = await createAuthenticatedRequest('/api/compositions', {
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    const ids = data.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(toDelete.id);
  });
});

// ---------------------------------------------------------------------------
// GET /api/compositions/trash — trashed compositions only
// ---------------------------------------------------------------------------

describe('GET /api/compositions/trash', () => {
  it('should return only soft-deleted compositions', async () => {
    const active = await createTestComposition(env, userId, { name: 'Still Active' });
    const trashed = await createTestComposition(env, userId, { name: 'In Trash' });
    await softDeleteComposition(env, trashed.id);

    const req = await createAuthenticatedRequest('/api/compositions/trash', {
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    const ids = data.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(trashed.id);
    expect(ids).not.toContain(active.id);
  });

  it('should not show other user\'s trashed compositions', async () => {
    const otherTrashed = await createTestComposition(env, otherUserId, { name: 'Other Trashed' });
    await softDeleteComposition(env, otherTrashed.id);

    const req = await createAuthenticatedRequest('/api/compositions/trash', {
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    const ids = data.items.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(otherTrashed.id);
  });
});

// ---------------------------------------------------------------------------
// POST /api/compositions/:id/restore — restore from trash
// ---------------------------------------------------------------------------

describe('POST /api/compositions/:id/restore', () => {
  it('should restore a soft-deleted composition', async () => {
    const composition = await createTestComposition(env, userId, { name: 'To Restore' });
    await softDeleteComposition(env, composition.id);

    const req = await createAuthenticatedRequest(`/api/compositions/${composition.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    // Verify deleted_at is cleared
    const row = await env.DB.prepare('SELECT deleted_at FROM compositions WHERE id = ?')
      .bind(composition.id)
      .first<{ deleted_at: number | null }>();
    expect(row!.deleted_at).toBeNull();
  });

  it('should return 404 for non-trashed composition', async () => {
    const active = await createTestComposition(env, userId, { name: 'Not Trashed' });

    const req = await createAuthenticatedRequest(`/api/compositions/${active.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow restoring another user\'s trashed composition', async () => {
    const otherComposition = await createTestComposition(env, otherUserId, { name: 'Other Trashed' });
    await softDeleteComposition(env, otherComposition.id);

    const req = await createAuthenticatedRequest(`/api/compositions/${otherComposition.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/compositions/:id/permanent — permanent delete
// ---------------------------------------------------------------------------

describe('DELETE /api/compositions/:id/permanent', () => {
  it('should permanently delete a trashed composition', async () => {
    const composition = await createTestComposition(env, userId, { name: 'To Permanently Delete' });
    await softDeleteComposition(env, composition.id);

    const req = await createAuthenticatedRequest(`/api/compositions/${composition.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify it's gone from DB entirely
    const row = await env.DB.prepare('SELECT id FROM compositions WHERE id = ?')
      .bind(composition.id)
      .first();
    expect(row).toBeNull();
  });

  it('should return 404 for non-trashed composition', async () => {
    const active = await createTestComposition(env, userId, { name: 'Active, Not Trashed' });

    const req = await createAuthenticatedRequest(`/api/compositions/${active.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow permanently deleting another user\'s composition', async () => {
    const otherComposition = await createTestComposition(env, otherUserId, { name: 'Other Perm Delete' });
    await softDeleteComposition(env, otherComposition.id);

    const req = await createAuthenticatedRequest(`/api/compositions/${otherComposition.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should also delete preview from R2 when permanently deleting', async () => {
    const previewKey = `users/${userId}/previews/perm-delete-test.png`;
    await env.FILES.put(previewKey, new Uint8Array([1, 2, 3]));

    const composition = await createTestComposition(env, userId, {
      name: 'With Preview',
      previewR2Key: previewKey,
    });
    await softDeleteComposition(env, composition.id);

    const req = await createAuthenticatedRequest(`/api/compositions/${composition.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    // Verify R2 object is gone
    const r2Obj = await env.FILES.get(previewKey);
    expect(r2Obj).toBeNull();
  });
});
