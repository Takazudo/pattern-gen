/**
 * Tests for file dustbox (soft-delete) endpoints:
 * - DELETE /api/files/:id — soft-delete (set deleted_at)
 * - GET /api/files — excludes soft-deleted
 * - GET /api/files/trash — returns only soft-deleted
 * - POST /api/files/:id/restore — restore from trash
 * - DELETE /api/files/:id/permanent — permanently delete from D1 + R2
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
  createTestFile,
  softDeleteFile,
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

  const user = await createTestUser(env.DB, { name: 'File Dustbox User' });
  userId = user.id;
  const session = await createTestSession(env.DB, userId);
  sessionId = session.id;

  const otherUser = await createTestUser(env.DB, { name: 'Other File User' });
  otherUserId = otherUser.id;
  const otherSession = await createTestSession(env.DB, otherUserId);
  otherSessionId = otherSession.id;
});

afterAll(async () => {
  await mf.dispose();
});

// ---------------------------------------------------------------------------
// DELETE /api/files/:id — soft-delete
// ---------------------------------------------------------------------------

describe('DELETE /api/files/:id (soft-delete)', () => {
  it('should soft-delete a file (set deleted_at)', async () => {
    const file = await createTestFile(env, userId, { filename: 'to-soft-delete.png' });

    const req = await createAuthenticatedRequest(`/api/files/${file.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify soft-deleted
    const row = await env.DB.prepare('SELECT deleted_at FROM files WHERE id = ?')
      .bind(file.id)
      .first<{ deleted_at: number | null }>();
    expect(row).toBeTruthy();
    expect(row!.deleted_at).toBeTruthy();
  });

  it('should return 404 for non-existent file', async () => {
    const req = await createAuthenticatedRequest('/api/files/nonexistent', {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow deleting another user\'s file', async () => {
    const otherFile = await createTestFile(env, otherUserId, { filename: 'other-file.png' });

    const req = await createAuthenticatedRequest(`/api/files/${otherFile.id}`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should keep R2 object intact after soft-delete', async () => {
    const file = await createTestFile(env, userId, { filename: 'keep-r2.png' });
    const r2Key = file.r2_key;

    const req = await createAuthenticatedRequest(`/api/files/${file.id}`, {
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
// GET /api/files — excludes soft-deleted
// ---------------------------------------------------------------------------

describe('GET /api/files (excludes soft-deleted)', () => {
  it('should not include soft-deleted files in listing', async () => {
    const active = await createTestFile(env, userId, { filename: 'active-file.png' });
    const toDelete = await createTestFile(env, userId, { filename: 'will-delete.png' });
    await softDeleteFile(env, toDelete.id);

    const req = await createAuthenticatedRequest('/api/files', {
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
// GET /api/files/trash — trashed files only
// ---------------------------------------------------------------------------

describe('GET /api/files/trash', () => {
  it('should return only soft-deleted files', async () => {
    const active = await createTestFile(env, userId, { filename: 'still-active.png' });
    const trashed = await createTestFile(env, userId, { filename: 'in-trash.png' });
    await softDeleteFile(env, trashed.id);

    const req = await createAuthenticatedRequest('/api/files/trash', {
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

  it('should not show other user\'s trashed files', async () => {
    const otherTrashed = await createTestFile(env, otherUserId, { filename: 'other-trashed.png' });
    await softDeleteFile(env, otherTrashed.id);

    const req = await createAuthenticatedRequest('/api/files/trash', {
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
// POST /api/files/:id/restore — restore from trash
// ---------------------------------------------------------------------------

describe('POST /api/files/:id/restore', () => {
  it('should restore a soft-deleted file', async () => {
    const file = await createTestFile(env, userId, { filename: 'to-restore.png' });
    await softDeleteFile(env, file.id);

    const req = await createAuthenticatedRequest(`/api/files/${file.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    // Verify deleted_at is cleared
    const row = await env.DB.prepare('SELECT deleted_at FROM files WHERE id = ?')
      .bind(file.id)
      .first<{ deleted_at: number | null }>();
    expect(row!.deleted_at).toBeNull();
  });

  it('should return 404 for non-trashed file', async () => {
    const active = await createTestFile(env, userId, { filename: 'not-trashed.png' });

    const req = await createAuthenticatedRequest(`/api/files/${active.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow restoring another user\'s trashed file', async () => {
    const otherFile = await createTestFile(env, otherUserId, { filename: 'other-restore.png' });
    await softDeleteFile(env, otherFile.id);

    const req = await createAuthenticatedRequest(`/api/files/${otherFile.id}/restore`, {
      method: 'POST',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/files/:id/permanent — permanent delete
// ---------------------------------------------------------------------------

describe('DELETE /api/files/:id/permanent', () => {
  it('should permanently delete a trashed file from D1 and R2', async () => {
    const file = await createTestFile(env, userId, { filename: 'perm-delete.png' });
    const r2Key = file.r2_key;
    await softDeleteFile(env, file.id);

    const req = await createAuthenticatedRequest(`/api/files/${file.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify it's gone from D1
    const row = await env.DB.prepare('SELECT id FROM files WHERE id = ?')
      .bind(file.id)
      .first();
    expect(row).toBeNull();

    // Verify it's gone from R2
    const r2Obj = await env.FILES.get(r2Key);
    expect(r2Obj).toBeNull();
  });

  it('should return 404 for non-trashed file', async () => {
    const active = await createTestFile(env, userId, { filename: 'active-no-perm.png' });

    const req = await createAuthenticatedRequest(`/api/files/${active.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });

  it('should not allow permanently deleting another user\'s file', async () => {
    const otherFile = await createTestFile(env, otherUserId, { filename: 'other-perm.png' });
    await softDeleteFile(env, otherFile.id);

    const req = await createAuthenticatedRequest(`/api/files/${otherFile.id}/permanent`, {
      method: 'DELETE',
      userId,
      sessionId,
    });

    const res = await app.request(req, undefined, env);
    expect(res.status).toBe(404);
  });
});
