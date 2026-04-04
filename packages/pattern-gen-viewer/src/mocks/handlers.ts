/**
 * MSW request handlers for all API endpoints.
 * Provides a fully functional mock backend for frontend development.
 */
import { http, HttpResponse } from 'msw';
import {
  mockUser,
  initialCompositions,
  initialTrashedCompositions,
  initialAssets,
  initialTrashedAssets,
  type MockComposition,
  type MockAsset,
  type MockUser,
} from './data.js';

// ─── In-memory stores ──────────────────────────────────────

let user: MockUser = { ...mockUser };
let compositions: MockComposition[] = [...initialCompositions];
let trashedCompositions: MockComposition[] = [...initialTrashedCompositions];
let assets: MockAsset[] = [...initialAssets];
let trashedAssets: MockAsset[] = [...initialTrashedAssets];
let userPhotoData: Uint8Array | null = null;

/** Reset all stores (useful for test isolation) */
export function resetStores() {
  user = { ...mockUser };
  compositions = initialCompositions.map((p) => ({ ...p }));
  trashedCompositions = initialTrashedCompositions.map((p) => ({ ...p }));
  assets = initialAssets.map((f) => ({ ...f }));
  trashedAssets = initialTrashedAssets.map((f) => ({ ...f }));
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

function compositionToResponse(p: MockComposition) {
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

function assetToResponse(f: MockAsset) {
  return {
    id: f.id,
    filename: f.filename,
    contentType: f.contentType,
    sizeBytes: f.sizeBytes,
    notes: f.notes,
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
    return HttpResponse.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      nickname: user.nickname,
      photoUrl: user.photoUrl,
      pictureUrl: user.pictureUrl,
      createdAt: user.createdAt,
    });
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

  // ─── Compositions ───────────────────────────────────────

  http.get('/api/compositions', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const active = compositions.filter((p) => p.deletedAt === null);
    const sorted = active.sort((a, b) => b.createdAt - a.createdAt);
    const items = sorted.slice(offset, offset + limit).map(compositionToResponse);

    return HttpResponse.json({
      items,
      total: active.length,
      limit,
      offset,
    });
  }),

  http.post('/api/compositions', async ({ request }) => {
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
    const composition: MockComposition = {
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
    compositions.push(composition);
    return HttpResponse.json(compositionToResponse(composition), { status: 201 });
  }),

  http.get('/api/compositions/trash', () => {
    const items = trashedCompositions
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      .map(compositionToResponse);
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get('/api/compositions/:id', ({ params }) => {
    const composition = compositions.find((p) => p.id === params.id && p.deletedAt === null);
    if (!composition) {
      return HttpResponse.json({ error: 'Composition not found' }, { status: 404 });
    }
    return HttpResponse.json(compositionToResponse(composition));
  }),

  http.get('/api/compositions/:id/preview', ({ params }) => {
    const composition = compositions.find((p) => p.id === params.id);
    if (!composition?.previewR2Key) {
      return HttpResponse.json({ error: 'Preview not found' }, { status: 404 });
    }
    return new HttpResponse(PLACEHOLDER_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }),

  http.put('/api/compositions/:id', async ({ params, request }) => {
    const composition = compositions.find((p) => p.id === params.id && p.deletedAt === null);
    if (!composition) {
      return HttpResponse.json({ error: 'Composition not found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      configJson?: string;
      patternType?: string;
      previewDataUrl?: string;
    };

    if (body.name !== undefined) composition.name = body.name;
    if (body.configJson !== undefined) composition.configJson = body.configJson;
    if (body.patternType !== undefined) composition.patternType = body.patternType;
    if (body.previewDataUrl) {
      composition.previewR2Key = `users/${user.id}/previews/${composition.id}.png`;
    }
    composition.updatedAt = Date.now();

    return HttpResponse.json(compositionToResponse(composition));
  }),

  http.delete('/api/compositions/:id', ({ params }) => {
    const idx = compositions.findIndex((p) => p.id === params.id && p.deletedAt === null);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Composition not found' }, { status: 404 });
    }
    const [composition] = compositions.splice(idx, 1);
    composition.deletedAt = Date.now();
    trashedCompositions.push(composition);
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/compositions/:id/restore', ({ params }) => {
    const idx = trashedCompositions.findIndex((p) => p.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Composition not found in trash' }, { status: 404 });
    }
    const [composition] = trashedCompositions.splice(idx, 1);
    composition.deletedAt = null;
    compositions.push(composition);
    return HttpResponse.json(compositionToResponse(composition));
  }),

  http.delete('/api/compositions/:id/permanent', ({ params }) => {
    const idx = trashedCompositions.findIndex((p) => p.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Composition not found in trash' }, { status: 404 });
    }
    trashedCompositions.splice(idx, 1);
    return HttpResponse.json({ ok: true });
  }),

  // ─── Assets ─────────────────────────────────────────────

  http.get('/api/assets', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const active = assets.filter((f) => f.deletedAt === null);
    const sorted = active.sort((a, b) => b.createdAt - a.createdAt);
    const items = sorted.slice(offset, offset + limit).map(assetToResponse);

    return HttpResponse.json({
      items,
      total: active.length,
      limit,
      offset,
    });
  }),

  http.post('/api/assets', async ({ request }) => {
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    const buffer = await request.arrayBuffer();
    const filename = request.headers.get('X-Filename') || `upload-${Date.now()}`;

    const now = Date.now();
    const asset: MockAsset = {
      id: nextId('file'),
      filename,
      contentType,
      sizeBytes: buffer.byteLength,
      notes: null,
      createdAt: now,
      deletedAt: null,
    };
    assets.push(asset);
    return HttpResponse.json(assetToResponse(asset), { status: 201 });
  }),

  http.get('/api/assets/trash', () => {
    const items = trashedAssets
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      .map(assetToResponse);
    return HttpResponse.json({ items, total: items.length });
  }),

  http.get('/api/assets/:id', ({ params }) => {
    const asset = assets.find((f) => f.id === params.id && f.deletedAt === null);
    if (!asset) {
      return HttpResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return HttpResponse.json(assetToResponse(asset));
  }),

  http.patch('/api/assets/:id', async ({ params, request }) => {
    const asset = assets.find((f) => f.id === params.id && f.deletedAt === null);
    if (!asset) {
      return HttpResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    const body = (await request.json()) as { notes?: string | null };
    if (body.notes !== undefined) {
      asset.notes = body.notes;
    }
    return HttpResponse.json(assetToResponse(asset));
  }),

  http.get('/api/assets/:id/download', ({ params }) => {
    const asset = assets.find((f) => f.id === params.id && f.deletedAt === null);
    if (!asset) {
      return HttpResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    return new HttpResponse(PLACEHOLDER_PNG, {
      headers: {
        'Content-Type': asset.contentType,
        'Content-Disposition': `attachment; filename="${asset.filename}"`,
        'Content-Length': String(asset.sizeBytes),
      },
    });
  }),

  http.delete('/api/assets/:id', ({ params }) => {
    const idx = assets.findIndex((f) => f.id === params.id && f.deletedAt === null);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    const [asset] = assets.splice(idx, 1);
    asset.deletedAt = Date.now();
    trashedAssets.push(asset);
    return HttpResponse.json({ ok: true });
  }),

  http.post('/api/assets/:id/restore', ({ params }) => {
    const idx = trashedAssets.findIndex((f) => f.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Asset not found in trash' }, { status: 404 });
    }
    const [asset] = trashedAssets.splice(idx, 1);
    asset.deletedAt = null;
    assets.push(asset);
    return HttpResponse.json(assetToResponse(asset));
  }),

  http.delete('/api/assets/:id/permanent', ({ params }) => {
    const idx = trashedAssets.findIndex((f) => f.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ error: 'Asset not found in trash' }, { status: 404 });
    }
    trashedAssets.splice(idx, 1);
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
