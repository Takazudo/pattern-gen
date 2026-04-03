/**
 * Tests for pattern dustbox (soft-delete) endpoints:
 * - DELETE /api/patterns/:id — soft-delete (set deleted_at)
 * - GET /api/patterns — excludes soft-deleted
 * - GET /api/patterns/trash — returns only soft-deleted
 * - POST /api/patterns/:id/restore — clear deleted_at
 * - DELETE /api/patterns/:id/permanent — permanently delete
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
  createTestPattern,
  softDeletePattern,
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
// DELETE /api/patterns/:id — soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /api/patterns/:id (soft-delete)', () => {
  it('should soft-delete a pattern (set deleted_at)', async () => {
    const pattern = await createTestPattern(env, userId, { name: 'To Soft Delete' });

    const req = await createAuthenticatedRequest(`/api/patterns/${pattern.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify it's soft-deleted (has deleted_at)
    const row = await env.DB.prepare('SELECT deleted_at FROM patterns WHERE id = ?')
      .bind(pattern.id)
      .first<{ deleted_at: number | null }>();
    expect(row).toBeTruthy();
    expect(row!.deleted_at).toBeTruthy();
  });

  it('should return 404 for non-existent pattern', async () => {
    const req = await createAuthenticatedRequest('/api/patterns/nonexistent', {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow deleting another user\'s pattern', async () => {
    const otherPattern = await createTestPattern(env, otherUserId, { name: 'Other Pattern' });

    const req = await createAuthenticatedRequest(`/api/patterns/${otherPattern.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/patterns — excludes soft-deleted
// ---------------------------------------------------------------------------

describe('GET /api/patterns (excludes soft-deleted)', () => {
  it('should not include soft-deleted patterns in listing', async () => {
    const active = await createTestPattern(env, userId, { name: 'Active Pattern' });
    const toDelete = await createTestPattern(env, userId, { name: 'Will Be Deleted' });
    await softDeletePattern(env, toDelete.id);

    const req = await createAuthenticatedRequest('/api/patterns', {
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
// GET /api/patterns/trash — trashed patterns only
// ---------------------------------------------------------------------------

describe('GET /api/patterns/trash', () => {
  it('should return only soft-deleted patterns', async () => {
    const active = await createTestPattern(env, userId, { name: 'Still Active' });
    const trashed = await createTestPattern(env, userId, { name: 'In Trash' });
    await softDeletePattern(env, trashed.id);

    const req = await createAuthenticatedRequest('/api/patterns/trash', {
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

  it('should not show other user\'s trashed patterns', async () => {
    const otherTrashed = await createTestPattern(env, otherUserId, { name: 'Other Trashed' });
    await softDeletePattern(env, otherTrashed.id);

    const req = await createAuthenticatedRequest('/api/patterns/trash', {
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
// POST /api/patterns/:id/restore — restore from trash
// ---------------------------------------------------------------------------

describe('POST /api/patterns/:id/restore', () => {
  it('should restore a soft-deleted pattern', async () => {
    const pattern = await createTestPattern(env, userId, { name: 'To Restore' });
    await softDeletePattern(env, pattern.id);

    const req = await createAuthenticatedRequest(`/api/patterns/${pattern.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    // Verify deleted_at is cleared
    const row = await env.DB.prepare('SELECT deleted_at FROM patterns WHERE id = ?')
      .bind(pattern.id)
      .first<{ deleted_at: number | null }>();
    expect(row!.deleted_at).toBeNull();
  });

  it('should return 404 for non-trashed pattern', async () => {
    const active = await createTestPattern(env, userId, { name: 'Not Trashed' });

    const req = await createAuthenticatedRequest(`/api/patterns/${active.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow restoring another user\'s trashed pattern', async () => {
    const otherPattern = await createTestPattern(env, otherUserId, { name: 'Other Trashed' });
    await softDeletePattern(env, otherPattern.id);

    const req = await createAuthenticatedRequest(`/api/patterns/${otherPattern.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/patterns/:id/permanent — permanent delete
// ---------------------------------------------------------------------------

describe('DELETE /api/patterns/:id/permanent', () => {
  it('should permanently delete a trashed pattern', async () => {
    const pattern = await createTestPattern(env, userId, { name: 'To Permanently Delete' });
    await softDeletePattern(env, pattern.id);

    const req = await createAuthenticatedRequest(`/api/patterns/${pattern.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify it's gone from DB entirely
    const row = await env.DB.prepare('SELECT id FROM patterns WHERE id = ?')
      .bind(pattern.id)
      .first();
    expect(row).toBeNull();
  });

  it('should return 404 for non-trashed pattern', async () => {
    const active = await createTestPattern(env, userId, { name: 'Active, Not Trashed' });

    const req = await createAuthenticatedRequest(`/api/patterns/${active.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow permanently deleting another user\'s pattern', async () => {
    const otherPattern = await createTestPattern(env, otherUserId, { name: 'Other Perm Delete' });
    await softDeletePattern(env, otherPattern.id);

    const req = await createAuthenticatedRequest(`/api/patterns/${otherPattern.id}/permanent`, {
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

    const pattern = await createTestPattern(env, userId, {
      name: 'With Preview',
      previewR2Key: previewKey,
    });
    await softDeletePattern(env, pattern.id);

    const req = await createAuthenticatedRequest(`/api/patterns/${pattern.id}/permanent`, {
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
