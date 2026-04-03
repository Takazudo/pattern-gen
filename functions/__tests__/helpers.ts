/**
 * Test helpers for Cloudflare Pages Functions tests.
 *
 * Uses Miniflare for real D1/R2 bindings so tests exercise actual SQL and
 * object storage rather than hand-rolled mocks.
 *
 * NOTE: Test files import the Hono apps from the functions/ directory.
 * Those imports will resolve once the backend implementation is merged.
 */

import { Miniflare, type D1Database, type R2Bucket } from 'miniflare';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';

// ---------------------------------------------------------------------------
// Migration SQL — mirrors migrations/0001_init.sql
// ---------------------------------------------------------------------------

const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, auth0_sub TEXT UNIQUE NOT NULL, email TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0, name TEXT, nickname TEXT, picture_url TEXT, photo_r2_key TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), refresh_token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_seen_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS patterns (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, config_json TEXT NOT NULL, pattern_type TEXT, preview_r2_key TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), r2_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at INTEGER)`,
];

// ---------------------------------------------------------------------------
// Test configuration — deterministic secrets for testing
// ---------------------------------------------------------------------------

export const TEST_CONFIG = {
  AUTH0_DOMAIN: 'test.auth0.com',
  AUTH0_CLIENT_ID: 'test-client-id',
  AUTH0_CLIENT_SECRET: 'test-client-secret',
  APP_JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long',
  COOKIE_SECRET: 'test-cookie-secret-at-least-32chars',
  APP_BASE_URL: 'https://test.example.com',
} as const;

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

export interface TestEnv {
  DB: D1Database;
  FILES: R2Bucket;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  APP_JWT_SECRET: string;
  COOKIE_SECRET: string;
  APP_BASE_URL: string;
}

/**
 * Create an isolated Miniflare instance with real D1 + R2.
 * Each call spins up a fresh environment — suitable for beforeEach or beforeAll.
 */
export async function createTestEnv(): Promise<{
  mf: Miniflare;
  env: TestEnv;
}> {
  const mf = new Miniflare({
    modules: true,
    // Dummy script — we never call the worker; we test Hono apps directly.
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: 'test-db-id' },
    r2Buckets: { FILES: 'test-bucket-id' },
    bindings: { ...TEST_CONFIG },
  });

  const db = await mf.getD1Database('DB');
  const files = await mf.getR2Bucket('FILES');

  const env: TestEnv = {
    DB: db,
    FILES: files,
    ...TEST_CONFIG,
  };

  return { mf, env };
}

/**
 * Run migration SQL to set up D1 tables.
 */
export async function setupDb(db: D1Database): Promise<void> {
  for (const sql of MIGRATION_STATEMENTS) {
    await db.exec(sql);
  }
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let userCounter = 0;

export async function createTestUser(
  db: D1Database,
  overrides: {
    id?: string;
    auth0_sub?: string;
    email?: string;
    email_verified?: number;
    name?: string;
    picture_url?: string | null;
  } = {},
) {
  userCounter++;
  const user = {
    id: overrides.id ?? crypto.randomUUID(),
    auth0_sub:
      overrides.auth0_sub ??
      `auth0|test-user-${userCounter}-${crypto.randomUUID().slice(0, 8)}`,
    email: overrides.email ?? `testuser${userCounter}@example.com`,
    email_verified: overrides.email_verified ?? 1,
    name: overrides.name ?? `Test User ${userCounter}`,
    picture_url: overrides.picture_url ?? null,
  };

  await db
    .prepare(
      `INSERT INTO users (id, auth0_sub, email, email_verified, name, picture_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id,
      user.auth0_sub,
      user.email,
      user.email_verified,
      user.name,
      user.picture_url,
    )
    .run();

  return user;
}

export async function createTestSession(
  db: D1Database,
  userId: string,
  overrides: {
    id?: string;
    expiresAt?: number; // Unix timestamp in ms (matches backend)
  } = {},
) {
  const refreshToken = crypto.randomUUID();
  const refreshTokenHash = await hashToken(refreshToken);
  const now = Date.now();

  const session = {
    id: overrides.id ?? crypto.randomUUID(),
    user_id: userId,
    refresh_token_hash: refreshTokenHash,
    expires_at:
      overrides.expiresAt ??
      now + 30 * 24 * 60 * 60 * 1000, // 30 days from now
  };

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(session.id, session.user_id, session.refresh_token_hash, session.expires_at, now, now)
    .run();

  return { ...session, refreshToken };
}

// ---------------------------------------------------------------------------
// JWT / Cookie helpers
// ---------------------------------------------------------------------------

const JWT_SECRET_ENCODED = new TextEncoder().encode(TEST_CONFIG.APP_JWT_SECRET);

/**
 * Sign a HS256 access JWT matching the backend's format.
 */
export async function signTestAccessToken(
  userId: string,
  sessionId: string,
  options: { expiresIn?: string } = {},
): Promise<string> {
  return new jose.SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '15m')
    .sign(JWT_SECRET_ENCODED);
}

/**
 * Sign an already-expired JWT for negative tests.
 */
export async function signExpiredAccessToken(
  userId: string,
  sessionId: string,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  const exp = iat + 60; // expired 59 minutes ago

  return new jose.SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(JWT_SECRET_ENCODED);
}

/**
 * Format cookie header string for __Host-access and __Host-refresh.
 */
export function makeAuthCookies(
  accessToken: string,
  refreshToken?: string,
): string {
  let cookies = `__Host-access=${accessToken}`;
  if (refreshToken) {
    cookies += `; __Host-refresh=${refreshToken}`;
  }
  return cookies;
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

/**
 * Create a Request object pre-configured with valid auth cookies and Origin.
 * Suitable for passing to `app.request()`.
 */
export async function createAuthenticatedRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    userId?: string;
    sessionId?: string;
    accessToken?: string;
    refreshToken?: string;
    extraHeaders?: Record<string, string>;
    omitOrigin?: boolean;
  } = {},
): Promise<Request> {
  const userId = options.userId ?? 'default-test-user';
  const sessionId = options.sessionId ?? 'default-test-session';
  const accessToken =
    options.accessToken ?? (await signTestAccessToken(userId, sessionId));
  const cookies = makeAuthCookies(accessToken, options.refreshToken);

  const headers: Record<string, string> = {
    Cookie: cookies,
    ...options.extraHeaders,
  };

  if (!options.omitOrigin) {
    headers['Origin'] = TEST_CONFIG.APP_BASE_URL;
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  return new Request(`${TEST_CONFIG.APP_BASE_URL}${path}`, init);
}

// ---------------------------------------------------------------------------
// Crypto utilities
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash a token string (matches the backend's hashing).
 */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Test auth middleware — mirrors functions/api/_middleware.ts
// ---------------------------------------------------------------------------

/**
 * Auth middleware for testing, matching the real _middleware.ts behavior.
 * Handles CSRF origin check, JWT verification, and session validation.
 *
 * Use this to wrap the API Hono app in tests since Pages _middleware.ts
 * doesn't run when calling app.request() directly.
 */
export function createTestAuthMiddleware() {
  return createMiddleware(async (c, next) => {
    const env = c.env as TestEnv;

    // CSRF check on mutating methods
    const method = c.req.method;
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      const origin = c.req.header('Origin');
      const expectedOrigin = new URL(c.req.url).origin;
      if (!origin || origin !== expectedOrigin) {
        return c.json({ error: 'CSRF origin mismatch' }, 403);
      }
    }

    // Extract access JWT from cookie
    const cookieHeader = c.req.header('Cookie') || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((pair) => {
        const [k, ...v] = pair.trim().split('=');
        return [k, v.join('=')];
      }),
    );

    const accessToken = cookies['__Host-access'];
    if (!accessToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const signingKey = new TextEncoder().encode(env.APP_JWT_SECRET);
      const { payload } = await jose.jwtVerify(accessToken, signingKey);

      const userId = payload.sub;
      const sessionId = payload.sid as string | undefined;

      if (!userId || !sessionId) {
        return c.json({ error: 'Invalid token claims' }, 401);
      }

      // Verify session is still valid
      const session = await env.DB.prepare(
        'SELECT revoked_at, expires_at FROM sessions WHERE id = ?1 AND user_id = ?2',
      )
        .bind(sessionId, userId)
        .first<{ revoked_at: number | null; expires_at: number }>();

      if (!session || session.revoked_at || session.expires_at < Date.now()) {
        return c.json({ error: 'Session revoked or expired' }, 401);
      }

      c.set('auth', { userId, sessionId });
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    await next();
  });
}

/**
 * Create a Hono app with auth middleware applied, suitable for testing
 * API routes that rely on the middleware setting auth context.
 *
 * Usage in test files:
 * ```ts
 * const app = createProtectedApp('/api');
 * // Then register routes or mount the imported app's routes
 * ```
 */
export function createProtectedApp(basePath = '/api'): Hono {
  const app = new Hono().basePath(basePath);
  app.use('*', createTestAuthMiddleware());
  return app;
}

/**
 * Build a test app that wraps the API routes behind auth middleware.
 * The API app must export `app` from functions/api/[[route]].ts.
 *
 * This is the standard test setup used across API test files.
 */
export function buildTestApiApp(apiApp: Hono): Hono {
  const testApp = new Hono();
  testApp.use('/api/*', createTestAuthMiddleware());
  testApp.route('/', apiApp);
  return testApp;
}

// ---------------------------------------------------------------------------
// Pattern / File factories
// ---------------------------------------------------------------------------

export function samplePatternConfig() {
  return {
    type: 'wood-block',
    size: 800,
    zoom: 1,
    colorScheme: 'warm-sunset',
    slug: 'test-pattern',
  };
}

export function sampleFileData() {
  return {
    filename: 'test-image.png',
    contentType: 'image/png',
    content: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), // PNG magic bytes
  };
}

// ---------------------------------------------------------------------------
// Pattern / File CRUD factories
// ---------------------------------------------------------------------------

let patternCounter = 0;

/**
 * Insert a test pattern into D1 and optionally store a preview in R2.
 */
export async function createTestPattern(
  env: TestEnv,
  userId: string,
  overrides: {
    id?: string;
    name?: string;
    configJson?: string;
    patternType?: string;
    previewR2Key?: string | null;
    deletedAt?: number | null;
  } = {},
) {
  patternCounter++;
  const now = Date.now();
  const id = overrides.id ?? crypto.randomUUID();
  const pattern = {
    id,
    user_id: userId,
    name: overrides.name ?? `Test Pattern ${patternCounter}`,
    config_json:
      overrides.configJson ??
      JSON.stringify(samplePatternConfig()),
    pattern_type: overrides.patternType ?? 'wood-block',
    preview_r2_key: overrides.previewR2Key ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: overrides.deletedAt ?? null,
  };

  await env.DB.prepare(
    `INSERT INTO patterns (id, user_id, name, config_json, pattern_type, preview_r2_key, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      pattern.id,
      pattern.user_id,
      pattern.name,
      pattern.config_json,
      pattern.pattern_type,
      pattern.preview_r2_key,
      pattern.created_at,
      pattern.updated_at,
      pattern.deleted_at,
    )
    .run();

  return pattern;
}

let fileCounter = 0;

/**
 * Insert a test file into D1 and store corresponding data in R2.
 */
export async function createTestFile(
  env: TestEnv,
  userId: string,
  overrides: {
    id?: string;
    filename?: string;
    contentType?: string;
    content?: Uint8Array;
    deletedAt?: number | null;
  } = {},
) {
  fileCounter++;
  const id = overrides.id ?? crypto.randomUUID();
  const filename = overrides.filename ?? `test-file-${fileCounter}.png`;
  const contentType = overrides.contentType ?? 'image/png';
  const content = overrides.content ?? sampleFileData().content;
  const r2Key = `users/${userId}/${id}-${filename}`;
  const now = Date.now();

  // Store in R2
  await env.FILES.put(r2Key, content, {
    httpMetadata: { contentType },
  });

  const file = {
    id,
    user_id: userId,
    r2_key: r2Key,
    filename,
    content_type: contentType,
    size_bytes: content.byteLength,
    created_at: now,
    deleted_at: overrides.deletedAt ?? null,
  };

  await env.DB.prepare(
    `INSERT INTO files (id, user_id, r2_key, filename, content_type, size_bytes, created_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      file.id,
      file.user_id,
      file.r2_key,
      file.filename,
      file.content_type,
      file.size_bytes,
      file.created_at,
      file.deleted_at,
    )
    .run();

  return file;
}

/**
 * Soft-delete a row in the given table by setting deleted_at.
 */
async function softDeleteRow(
  env: TestEnv,
  table: 'patterns' | 'files',
  id: string,
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`)
    .bind(now, id)
    .run();
}

export function softDeletePattern(env: TestEnv, patternId: string): Promise<void> {
  return softDeleteRow(env, 'patterns', patternId);
}

export function softDeleteFile(env: TestEnv, fileId: string): Promise<void> {
  return softDeleteRow(env, 'files', fileId);
}
