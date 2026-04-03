/** Cloudflare Pages Functions environment bindings */
export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  APP_JWT_SECRET: string;
  COOKIE_SECRET: string;
}

/** D1 row: users table */
export interface UserRow {
  id: string;
  auth0_sub: string;
  email: string | null;
  email_verified: number;
  name: string | null;
  picture_url: string | null;
  created_at: number;
  updated_at: number;
}

/** D1 row: sessions table */
export interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: number;
  revoked_at: number | null;
  created_at: number;
  last_seen_at: number;
}

/** D1 row: patterns table */
export interface PatternRow {
  id: string;
  user_id: string;
  name: string;
  config_json: string;
  pattern_type: string;
  preview_r2_key: string | null;
  created_at: number;
  updated_at: number;
}

/** D1 row: files table */
export interface FileRow {
  id: string;
  user_id: string;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: number;
}

/** Auth context attached to request by middleware */
export interface AuthContext {
  userId: string;
  sessionId: string;
}

/** API response: current user */
export interface UserResponse {
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  pictureUrl: string | null;
  createdAt: number;
}

/** API response: pattern */
export interface PatternResponse {
  id: string;
  name: string;
  configJson: string;
  patternType: string;
  previewR2Key: string | null;
  createdAt: number;
  updatedAt: number;
}

/** API response: file */
export interface FileResponse {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: number;
}

/** API request: create pattern */
export interface CreatePatternRequest {
  name: string;
  configJson: string;
  patternType: string;
  previewDataUrl?: string;
}

/** API request: update pattern */
export interface UpdatePatternRequest {
  name?: string;
  configJson?: string;
  patternType?: string;
  previewDataUrl?: string;
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
