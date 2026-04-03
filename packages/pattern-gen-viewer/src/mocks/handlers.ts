/**
 * MSW request handlers for all API endpoints.
 * Provides a fully functional mock backend for frontend development.
 */
import { http, HttpResponse } from 'msw';
import {
  mockUser,
  initialPatterns,
  initialTrashedPatterns,
  initialFiles,
  initialTrashedFiles,
  type MockPattern,
  type MockFile,
  type MockUser,
} from './data.js';

// ─── In-memory stores ──────────────────────────────────────

let user: MockUser = { ...mockUser };
let patterns: MockPattern[] = [...initialPatterns];
let trashedPatterns: MockPattern[] = [...initialTrashedPatterns];
let files: MockFile[] = [...initialFiles];
let trashedFiles: MockFile[] = [...initialTrashedFiles];
let userPhotoData: Uint8Array | null = null;

/** Reset all stores (useful for test isolation) */
export function resetStores() {
  user = { ...mockUser };
  patterns = initialPatterns.map((p) => ({ ...p }));
  trashedPatterns = initialTrashedPatterns.map((p) => ({ ...p }));
  files = initialFiles.map((f) => ({ ...f }));
  trashedFiles = initialTrashedFiles.map((f) => ({ ...f }));
  userPhotoData = null;
}

// ─── Helpers ───────────────────────────────────────────────

let idCounter = 100;
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

// 1x1 transparent PNG (smallest valid PNG)
const PLACEHOLDER_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84,
  120, 156, 98, 0, 0, 0, 2, 0, 1, 226, 33, 188, 51, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130,
]);

function patternToResponse(p: MockPattern) {
  return {
    id: p.id,
    name: p.name,
    configJson: p.configJson,
    patternType: p.patternType,
    previewR2Key: p.previewR2Key,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function fileToResponse(f: MockFile) {
  return {
    id: f.id,
    filename: f.filename,
    contentType: f.contentType,
    sizeBytes: f.sizeBytes,
    createdAt: f.createdAt,
  };
}

// ─── Handlers ──────────────────────────────────────────────

export const handlers = [
  // ─── User / Profile ──────────────────────────────────────

  http.get('/api/me', () => {
    return HttpResponse.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      nickname: user.nickname,
      pictureUrl: user.photoUrl,
      createdAt: user.createdAt,
    });
  }),

  http.patch('/api/me', async ({ request }) => {
    const body = (await request.json()) as { nickname?: string };
    if (body.nickname !== undefined) {
      user.nickname = body.nickname || null;
    }
    return HttpResponse.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      nickname: user.nickname,
      pictureUrl: user.photoUrl,
      createdAt: user.createdAt,
    });
  }),

  http.post('/api/me/photo', async ({ request }) => {
    const buffer = await request.arrayBuffer();
    userPhotoData = new Uint8Array(buffer);
    user.photoUrl = '/api/me/photo';
    return HttpResponse.json({ ok: true, photoUrl: '/api/me/photo' });
  }),

  http.get('/api/me/photo', () => {
    const data = userPhotoData ?? PLACEHOLDER_PNG;
    return new HttpResponse(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }),

  http.delete('/api/me/photo', () => {
    userPhotoData = null;
    user.photoUrl = null;
    return HttpResponse.json({ ok: true });
  }),

  // ─── Patterns ────────────────────────────────────────────

  http.get('/api/patterns', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const active = patterns.filter((p) => p.deletedAt === null);
    const sorted = active.sort((a, b) => b.createdAt - a.createdAt);
    const items = sorted.slice(offset, offset + limit).map(patternToResponse);

    return HttpResponse.json({
      items,
      total: active.length,
      limit,
      offset,
    });
  }),

  http.post('/api/patterns', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      configJson: string;
      patternType: string;
      previewDataUrl?: string;
    };

    if (!body.name || !body.configJson || !body.patternType) {
      return HttpResponse.json(
        { error: 'Missing required fields: name, configJson, patternType' },
        { status: 400 },
      );
    }

    const now = Date.now();
    const pattern: MockPattern = {
      id: nextId('pat'),
      name: body.name,
      configJson: body.configJson,
      patternType: body.patternType,
      previewR2Key: body.previewDataUrl
        ? `users/${user.id}/previews/${nextId('preview')}.png`
        : null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    patterns.push(pattern);
    return HttpResponse.json(patternToResponse(pattern), { status: 201 });
  }),

  http.get('/api/patterns/trash', () => {
    const items = trashedPatterns
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      .map(patternToResponse);
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get('/api/patterns/:id', ({ params }) => {
    const pattern = patterns.find((p) => p.id === params.id && p.deletedAt === null);
    if (!pattern) {
      return HttpResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }
    return HttpResponse.json(patternToResponse(pattern));
  }),

  http.get('/api/patterns/:id/preview', ({ params }) => {
    const pattern = patterns.find((p) => p.id === params.id);
    if (!pattern?.previewR2Key) {
      return HttpResponse.json({ error: 'Preview not found' }, { status: 404 });
    }
    return new HttpResponse(PLACEHOLDER_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }),

  http.put('/api/patterns/:id', async ({ params, request }) => {
    const pattern = patterns.find((p) => p.id === params.id && p.deletedAt === null);
    if (!pattern) {
      return HttpResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      configJson?: string;
      patternType?: string;
      previewDataUrl?: string;
    };

    if (body.name !== undefined) pattern.name = body.name;
    if (body.configJson !== undefined) pattern.configJson = body.configJson;
    if (body.patternType !== undefined) pattern.patternType = body.patternType;
    if (body.previewDataUrl) {
      pattern.previewR2Key = `users/${user.id}/previews/${pattern.id}.png`;
    }
    pattern.updatedAt = Date.now();

    return HttpResponse.json(patternToResponse(pattern));
  }),

  http.delete('/api/patterns/:id', ({ params }) => {
    const idx = patterns.findIndex((p) => p.id === params.id && p.deletedAt === null);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Pattern not found' }, { status: 404 });
    }
    const [pattern] = patterns.splice(idx, 1);
    pattern.deletedAt = Date.now();
    trashedPatterns.push(pattern);
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/patterns/:id/restore', ({ params }) => {
    const idx = trashedPatterns.findIndex((p) => p.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Pattern not found in trash' }, { status: 404 });
    }
    const [pattern] = trashedPatterns.splice(idx, 1);
    pattern.deletedAt = null;
    patterns.push(pattern);
    return HttpResponse.json(patternToResponse(pattern));
  }),

  http.delete('/api/patterns/:id/permanent', ({ params }) => {
    const idx = trashedPatterns.findIndex((p) => p.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Pattern not found in trash' }, { status: 404 });
    }
    trashedPatterns.splice(idx, 1);
    return HttpResponse.json({ ok: true });
  }),

  // ─── Files ───────────────────────────────────────────────

  http.get('/api/files', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const active = files.filter((f) => f.deletedAt === null);
    const sorted = active.sort((a, b) => b.createdAt - a.createdAt);
    const items = sorted.slice(offset, offset + limit).map(fileToResponse);

    return HttpResponse.json({
      items,
      total: active.length,
      limit,
      offset,
    });
  }),

  http.post('/api/files', async ({ request }) => {
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    const buffer = await request.arrayBuffer();
    const filename = request.headers.get('X-Filename') || `upload-${Date.now()}`;

    const now = Date.now();
    const file: MockFile = {
      id: nextId('file'),
      filename,
      contentType,
      sizeBytes: buffer.byteLength,
      createdAt: now,
      deletedAt: null,
    };
    files.push(file);
    return HttpResponse.json(fileToResponse(file), { status: 201 });
  }),

  http.get('/api/files/trash', () => {
    const items = trashedFiles
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      .map(fileToResponse);
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get('/api/files/:id', ({ params }) => {
    const file = files.find((f) => f.id === params.id && f.deletedAt === null);
    if (!file) {
      return HttpResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return HttpResponse.json(fileToResponse(file));
  }),

  http.get('/api/files/:id/download', ({ params }) => {
    const file = files.find((f) => f.id === params.id && f.deletedAt === null);
    if (!file) {
      return HttpResponse.json({ error: 'File not found' }, { status: 404 });
    }
    return new HttpResponse(PLACEHOLDER_PNG, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Content-Length': String(file.sizeBytes),
      },
    });
  }),

  http.delete('/api/files/:id', ({ params }) => {
    const idx = files.findIndex((f) => f.id === params.id && f.deletedAt === null);
    if (idx === -1) {
      return HttpResponse.json({ error: 'File not found' }, { status: 404 });
    }
    const [file] = files.splice(idx, 1);
    file.deletedAt = Date.now();
    trashedFiles.push(file);
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/files/:id/restore', ({ params }) => {
    const idx = trashedFiles.findIndex((f) => f.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'File not found in trash' }, { status: 404 });
    }
    const [file] = trashedFiles.splice(idx, 1);
    file.deletedAt = null;
    files.push(file);
    return HttpResponse.json(fileToResponse(file));
  }),

  http.delete('/api/files/:id/permanent', ({ params }) => {
    const idx = trashedFiles.findIndex((f) => f.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'File not found in trash' }, { status: 404 });
    }
    trashedFiles.splice(idx, 1);
    return HttpResponse.json({ ok: true });
  }),

  // ─── Auth ────────────────────────────────────────────────

  http.get('/auth/login', () => {
    // Mock login: redirect to callback with mock code
    return HttpResponse.redirect('/pj/pattern-gen/', 302);
  }),

  http.post('/auth/logout', () => {
    return HttpResponse.json({ ok: true });
  }),

  http.all('/auth/logout', () => {
    return HttpResponse.redirect('/pj/pattern-gen/', 302);
  }),

  http.post('/auth/refresh', () => {
    return HttpResponse.json({ ok: true });
  }),
];
