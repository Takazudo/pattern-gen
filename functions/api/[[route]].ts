import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import type {
  Bindings,
  AuthContext,
  UserRow,
  CompositionRow,
  AssetRow,
  FontFavoriteRow,
  CreateCompositionRequest,
  UpdateCompositionRequest,
  UpdateProfileRequest,
  CompositionResponse,
  AssetResponse,
  FontFavoriteResponse,
  PaginatedResponse,
} from "../types.js";

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

type HonoEnv = {
  Bindings: Bindings;
};

const app = new Hono<HonoEnv>().basePath("/api");

/** Generate a random hex ID */
function randomId(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert a CompositionRow to API response shape */
function toCompositionResponse(row: CompositionRow): CompositionResponse {
  return {
    id: row.id,
    name: row.name,
    configJson: row.config_json,
    patternType: row.pattern_type,
    previewR2Key: row.preview_r2_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Convert an AssetRow to API response shape */
function toAssetResponse(row: AssetRow): AssetResponse {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

/** Max upload size: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ─── User ───────────────────────────────────────────────────

app.get("/me", async (c) => {
  const auth = c.get("auth");
  const user = await c.env.DB.prepare(
    "SELECT id, email, email_verified, name, picture_url, nickname, photo_r2_key, created_at FROM users WHERE id = ?1"
  )
    .bind(auth.userId)
    .first<UserRow>();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified === 1,
    name: user.name,
    pictureUrl: user.picture_url,
    nickname: user.nickname,
    photoUrl: user.photo_r2_key ? "/api/me/photo" : null,
    createdAt: user.created_at,
  });
});

app.patch("/me", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<UpdateProfileRequest>();
  const now = Date.now();

  if (body.nickname !== undefined) {
    await c.env.DB.prepare(
      "UPDATE users SET nickname = ?1, updated_at = ?2 WHERE id = ?3"
    )
      .bind(body.nickname, now, auth.userId)
      .run();
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, email_verified, name, picture_url, nickname, photo_r2_key, created_at FROM users WHERE id = ?1"
  )
    .bind(auth.userId)
    .first<UserRow>();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified === 1,
    name: user.name,
    pictureUrl: user.picture_url,
    nickname: user.nickname,
    photoUrl: user.photo_r2_key ? "/api/me/photo" : null,
    createdAt: user.created_at,
  });
});

app.post("/me/photo", async (c) => {
  const auth = c.get("auth");
  const contentType = c.req.header("Content-Type") || "";

  let imageData: ArrayBuffer;
  let mimeType: string;

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || typeof file === "string") {
      return c.json({ error: "No file provided" }, 400);
    }
    imageData = await file.arrayBuffer();
    mimeType = file.type || "image/png";
  } else {
    imageData = await c.req.arrayBuffer();
    mimeType = contentType || "image/png";
  }

  if (imageData.byteLength > MAX_FILE_SIZE) {
    return c.json({ error: "File too large (max 10MB)" }, 413);
  }

  // Delete old photo from R2 if exists
  const existing = await c.env.DB.prepare(
    "SELECT photo_r2_key FROM users WHERE id = ?1"
  )
    .bind(auth.userId)
    .first<{ photo_r2_key: string | null }>();

  if (existing?.photo_r2_key) {
    await c.env.FILES.delete(existing.photo_r2_key);
  }

  // Store new photo
  const photoId = randomId();
  const r2Key = `users/${auth.userId}/photo/${photoId}`;
  await c.env.FILES.put(r2Key, imageData, {
    httpMetadata: { contentType: mimeType },
  });

  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE users SET photo_r2_key = ?1, updated_at = ?2 WHERE id = ?3"
  )
    .bind(r2Key, now, auth.userId)
    .run();

  const user = await c.env.DB.prepare(
    "SELECT id, email, email_verified, name, picture_url, nickname, photo_r2_key, created_at FROM users WHERE id = ?1"
  )
    .bind(auth.userId)
    .first<UserRow>();

  return c.json({
    id: user!.id,
    email: user!.email,
    emailVerified: user!.email_verified === 1,
    name: user!.name,
    pictureUrl: user!.picture_url,
    nickname: user!.nickname,
    photoUrl: "/api/me/photo",
    createdAt: user!.created_at,
  });
});

app.get("/me/photo", async (c) => {
  const auth = c.get("auth");

  const user = await c.env.DB.prepare(
    "SELECT photo_r2_key FROM users WHERE id = ?1"
  )
    .bind(auth.userId)
    .first<{ photo_r2_key: string | null }>();

  if (!user?.photo_r2_key) {
    return c.json({ error: "No photo" }, 404);
  }

  const r2Object = await c.env.FILES.get(user.photo_r2_key);
  if (!r2Object) {
    return c.json({ error: "Photo not found in storage" }, 404);
  }

  return new Response(r2Object.body, {
    headers: {
      "Content-Type": r2Object.httpMetadata?.contentType || "image/png",
      "Cache-Control": "no-cache",
    },
  });
});

app.delete("/me/photo", async (c) => {
  const auth = c.get("auth");

  const user = await c.env.DB.prepare(
    "SELECT photo_r2_key FROM users WHERE id = ?1"
  )
    .bind(auth.userId)
    .first<{ photo_r2_key: string | null }>();

  if (user?.photo_r2_key) {
    await c.env.FILES.delete(user.photo_r2_key);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE users SET photo_r2_key = NULL, updated_at = ?1 WHERE id = ?2"
  )
    .bind(now, auth.userId)
    .run();

  return c.json({ ok: true });
});

// ─── Compositions ─────────────────────────────────────────────

app.get("/compositions", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const [countResult, listResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM compositions WHERE user_id = ?1 AND deleted_at IS NULL"
    ).bind(auth.userId),
    c.env.DB.prepare(
      "SELECT * FROM compositions WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
    ).bind(auth.userId, limit, offset),
  ]);

  const total = (countResult.results[0] as { total: number }).total;
  const items = (listResult.results as CompositionRow[]).map(toCompositionResponse);

  return c.json({
    items,
    total,
    limit,
    offset,
  } satisfies PaginatedResponse<CompositionResponse>);
});

app.get("/compositions/trash", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const [countResult, listResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM compositions WHERE user_id = ?1 AND deleted_at IS NOT NULL"
    ).bind(auth.userId),
    c.env.DB.prepare(
      "SELECT * FROM compositions WHERE user_id = ?1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ?2 OFFSET ?3"
    ).bind(auth.userId, limit, offset),
  ]);

  const total = (countResult.results[0] as { total: number }).total;
  const items = (listResult.results as CompositionRow[]).map(toCompositionResponse);

  return c.json({
    items,
    total,
    limit,
    offset,
  } satisfies PaginatedResponse<CompositionResponse>);
});

app.get("/compositions/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const composition = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<CompositionRow>();

  if (!composition) {
    return c.json({ error: "Composition not found" }, 404);
  }

  return c.json(toCompositionResponse(composition));
});

app.post("/compositions", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<CreateCompositionRequest>();

  if (!body.name || !body.configJson || !body.patternType) {
    return c.json({ error: "Missing required fields: name, configJson, patternType" }, 400);
  }

  const id = randomId();
  const now = Date.now();
  let previewR2Key: string | null = null;

  // If preview data URL is provided, decode and store in R2
  if (body.previewDataUrl) {
    const match = body.previewDataUrl.match(
      /^data:([^;]+);base64,(.+)$/
    );
    if (match) {
      const contentType = match[1];
      const base64Data = match[2];
      const binaryData = Uint8Array.from(atob(base64Data), (ch) =>
        ch.charCodeAt(0)
      );
      previewR2Key = `users/${auth.userId}/previews/${id}.png`;
      await c.env.FILES.put(previewR2Key, binaryData, {
        httpMetadata: { contentType },
      });
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO compositions (id, user_id, name, config_json, pattern_type, preview_r2_key, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(id, auth.userId, body.name, body.configJson, body.patternType, previewR2Key, now, now)
    .run();

  const composition = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1"
  )
    .bind(id)
    .first<CompositionRow>();

  return c.json(toCompositionResponse(composition!), 201);
});

app.put("/compositions/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<CompositionRow>();

  if (!existing) {
    return c.json({ error: "Composition not found" }, 404);
  }

  const body = await c.req.json<UpdateCompositionRequest>();
  const now = Date.now();

  const name = body.name ?? existing.name;
  const configJson = body.configJson ?? existing.config_json;
  const patternType = body.patternType ?? existing.pattern_type;
  let previewR2Key = existing.preview_r2_key;

  // If new preview data URL, replace in R2
  if (body.previewDataUrl) {
    const match = body.previewDataUrl.match(
      /^data:([^;]+);base64,(.+)$/
    );
    if (match) {
      // Delete old preview if exists
      if (previewR2Key) {
        await c.env.FILES.delete(previewR2Key);
      }
      const contentType = match[1];
      const base64Data = match[2];
      const binaryData = Uint8Array.from(atob(base64Data), (ch) =>
        ch.charCodeAt(0)
      );
      previewR2Key = `users/${auth.userId}/previews/${id}.png`;
      await c.env.FILES.put(previewR2Key, binaryData, {
        httpMetadata: { contentType },
      });
    }
  }

  await c.env.DB.prepare(
    `UPDATE compositions SET name = ?1, config_json = ?2, pattern_type = ?3, preview_r2_key = ?4, updated_at = ?5
     WHERE id = ?6 AND user_id = ?7`
  )
    .bind(name, configJson, patternType, previewR2Key, now, id, auth.userId)
    .run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1"
  )
    .bind(id)
    .first<CompositionRow>();

  return c.json(toCompositionResponse(updated!));
});

app.get("/compositions/:id/preview", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const composition = await c.env.DB.prepare(
    "SELECT preview_r2_key FROM compositions WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<{ preview_r2_key: string | null }>();

  if (!composition?.preview_r2_key) {
    return c.json({ error: "Preview not found" }, 404);
  }

  const r2Object = await c.env.FILES.get(composition.preview_r2_key);
  if (!r2Object) {
    return c.json({ error: "Preview not found in storage" }, 404);
  }

  return new Response(r2Object.body, {
    headers: {
      "Content-Type": r2Object.httpMetadata?.contentType || "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

app.delete("/compositions/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const composition = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<CompositionRow>();

  if (!composition) {
    return c.json({ error: "Composition not found" }, 404);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE compositions SET deleted_at = ?1 WHERE id = ?2 AND user_id = ?3"
  )
    .bind(now, id, auth.userId)
    .run();

  return c.json({ ok: true });
});

app.post("/compositions/:id/restore", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const composition = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NOT NULL"
  )
    .bind(id, auth.userId)
    .first<CompositionRow>();

  if (!composition) {
    return c.json({ error: "Composition not found in trash" }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE compositions SET deleted_at = NULL WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .run();

  return c.json(toCompositionResponse({ ...composition, deleted_at: null }));
});

app.delete("/compositions/:id/permanent", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const composition = await c.env.DB.prepare(
    "SELECT * FROM compositions WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NOT NULL"
  )
    .bind(id, auth.userId)
    .first<CompositionRow>();

  if (!composition) {
    return c.json({ error: "Composition not found in trash" }, 404);
  }

  // Delete preview from R2 if exists
  if (composition.preview_r2_key) {
    await c.env.FILES.delete(composition.preview_r2_key);
  }

  await c.env.DB.prepare(
    "DELETE FROM compositions WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .run();

  return c.json({ ok: true });
});

// ─── Assets ────────────────────────────────────────────────

app.get("/assets", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const [countResult, listResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM assets WHERE user_id = ?1 AND deleted_at IS NULL"
    ).bind(auth.userId),
    c.env.DB.prepare(
      "SELECT * FROM assets WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
    ).bind(auth.userId, limit, offset),
  ]);

  const total = (countResult.results[0] as { total: number }).total;
  const items = (listResult.results as AssetRow[]).map(toAssetResponse);

  return c.json({
    items,
    total,
    limit,
    offset,
  } satisfies PaginatedResponse<AssetResponse>);
});

app.get("/assets/trash", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const [countResult, listResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM assets WHERE user_id = ?1 AND deleted_at IS NOT NULL"
    ).bind(auth.userId),
    c.env.DB.prepare(
      "SELECT * FROM assets WHERE user_id = ?1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ?2 OFFSET ?3"
    ).bind(auth.userId, limit, offset),
  ]);

  const total = (countResult.results[0] as { total: number }).total;
  const items = (listResult.results as AssetRow[]).map(toAssetResponse);

  return c.json({
    items,
    total,
    limit,
    offset,
  } satisfies PaginatedResponse<AssetResponse>);
});

app.post("/assets", async (c) => {
  const auth = c.get("auth");
  const contentType = c.req.header("Content-Type") || "";

  let fileData: ArrayBuffer;
  let filename: string;
  let mimeType: string;

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!file || typeof file === "string") {
      return c.json({ error: "No file provided" }, 400);
    }
    fileData = await file.arrayBuffer();
    filename = file.name;
    mimeType = file.type || "application/octet-stream";
  } else {
    // Raw body upload — filename from header or default
    fileData = await c.req.arrayBuffer();
    filename =
      c.req.header("X-Filename") || `upload-${Date.now()}`;
    mimeType = contentType || "application/octet-stream";
  }

  if (fileData.byteLength > MAX_FILE_SIZE) {
    return c.json({ error: "File too large (max 10MB)" }, 413);
  }

  const id = randomId();
  const r2Key = `users/${auth.userId}/${id}-${filename}`;
  const now = Date.now();

  await c.env.FILES.put(r2Key, fileData, {
    httpMetadata: { contentType: mimeType },
  });

  await c.env.DB.prepare(
    `INSERT INTO assets (id, user_id, r2_key, filename, content_type, size_bytes, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(id, auth.userId, r2Key, filename, mimeType, fileData.byteLength, now)
    .run();

  const row = await c.env.DB.prepare(
    "SELECT * FROM assets WHERE id = ?1"
  )
    .bind(id)
    .first<AssetRow>();

  return c.json(toAssetResponse(row!), 201);
});

app.get("/assets/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const asset = await c.env.DB.prepare(
    "SELECT * FROM assets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<AssetRow>();

  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }

  return c.json(toAssetResponse(asset));
});

app.get("/assets/:id/download", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const asset = await c.env.DB.prepare(
    "SELECT * FROM assets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<AssetRow>();

  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }

  const r2Object = await c.env.FILES.get(asset.r2_key);
  if (!r2Object) {
    return c.json({ error: "Asset not found in storage" }, 404);
  }

  return new Response(r2Object.body, {
    headers: {
      "Content-Type": asset.content_type,
      "Content-Disposition": `attachment; filename="${asset.filename}"`,
      "Content-Length": asset.size_bytes.toString(),
    },
  });
});

app.delete("/assets/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const asset = await c.env.DB.prepare(
    "SELECT * FROM assets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
  )
    .bind(id, auth.userId)
    .first<AssetRow>();

  if (!asset) {
    return c.json({ error: "Asset not found" }, 404);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    "UPDATE assets SET deleted_at = ?1 WHERE id = ?2 AND user_id = ?3"
  )
    .bind(now, id, auth.userId)
    .run();

  return c.json({ ok: true });
});

app.post("/assets/:id/restore", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const asset = await c.env.DB.prepare(
    "SELECT * FROM assets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NOT NULL"
  )
    .bind(id, auth.userId)
    .first<AssetRow>();

  if (!asset) {
    return c.json({ error: "Asset not found in trash" }, 404);
  }

  await c.env.DB.prepare(
    "UPDATE assets SET deleted_at = NULL WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .run();

  return c.json(toAssetResponse({ ...asset, deleted_at: null }));
});

app.delete("/assets/:id/permanent", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const asset = await c.env.DB.prepare(
    "SELECT * FROM assets WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NOT NULL"
  )
    .bind(id, auth.userId)
    .first<AssetRow>();

  if (!asset) {
    return c.json({ error: "Asset not found in trash" }, 404);
  }

  await c.env.FILES.delete(asset.r2_key);

  await c.env.DB.prepare(
    "DELETE FROM assets WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .run();

  return c.json({ ok: true });
});

// ─── Font Favorites ──────────────────────────────────────────

app.get("/font-favorites", async (c) => {
  const auth = c.get("auth");

  const result = await c.env.DB.prepare(
    "SELECT font_family, created_at FROM font_favorites WHERE user_id = ?1 ORDER BY created_at DESC"
  )
    .bind(auth.userId)
    .all<FontFavoriteRow>();

  const items: FontFavoriteResponse[] = result.results.map((row) => ({
    fontFamily: row.font_family,
    createdAt: row.created_at,
  }));

  return c.json({ items });
});

app.post("/font-favorites", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<{ fontFamily: string }>();

  if (!body.fontFamily) {
    return c.json({ error: "Missing required field: fontFamily" }, 400);
  }

  const id = randomId();
  const now = Math.floor(Date.now() / 1000);

  try {
    await c.env.DB.prepare(
      "INSERT INTO font_favorites (id, user_id, font_family, created_at) VALUES (?1, ?2, ?3, ?4)"
    )
      .bind(id, auth.userId, body.fontFamily, now)
      .run();
  } catch (err: unknown) {
    // UNIQUE constraint violation — already favorited, return existing
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      const existing = await c.env.DB.prepare(
        "SELECT font_family, created_at FROM font_favorites WHERE user_id = ?1 AND font_family = ?2"
      )
        .bind(auth.userId, body.fontFamily)
        .first<FontFavoriteRow>();

      return c.json({
        fontFamily: existing!.font_family,
        createdAt: existing!.created_at,
      } satisfies FontFavoriteResponse);
    }
    throw err;
  }

  return c.json(
    {
      fontFamily: body.fontFamily,
      createdAt: now,
    } satisfies FontFavoriteResponse,
    201
  );
});

app.delete("/font-favorites/:family", async (c) => {
  const auth = c.get("auth");
  const family = decodeURIComponent(c.req.param("family"));

  const result = await c.env.DB.prepare(
    "DELETE FROM font_favorites WHERE user_id = ?1 AND font_family = ?2"
  )
    .bind(auth.userId, family)
    .run();

  if (!result.meta.changes) {
    return c.json({ error: "Font favorite not found" }, 404);
  }

  return new Response(null, { status: 204 });
});

export { app };
export const onRequest = handle(app);
