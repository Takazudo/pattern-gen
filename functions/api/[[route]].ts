import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import type {
  Bindings,
  AuthContext,
  UserRow,
  PatternRow,
  FileRow,
  CreatePatternRequest,
  UpdatePatternRequest,
  PatternResponse,
  FileResponse,
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

/** Convert a PatternRow to API response shape */
function toPatternResponse(row: PatternRow): PatternResponse {
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

/** Convert a FileRow to API response shape */
function toFileResponse(row: FileRow): FileResponse {
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
    "SELECT id, email, email_verified, name, picture_url, created_at FROM users WHERE id = ?1"
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
    createdAt: user.created_at,
  });
});

// ─── Patterns ───────────────────────────────────────────────

app.get("/patterns", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const [countResult, listResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM patterns WHERE user_id = ?1"
    ).bind(auth.userId),
    c.env.DB.prepare(
      "SELECT * FROM patterns WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
    ).bind(auth.userId, limit, offset),
  ]);

  const total = (countResult.results[0] as { total: number }).total;
  const items = (listResult.results as PatternRow[]).map(toPatternResponse);

  return c.json({
    items,
    total,
    limit,
    offset,
  } satisfies PaginatedResponse<PatternResponse>);
});

app.get("/patterns/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const pattern = await c.env.DB.prepare(
    "SELECT * FROM patterns WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .first<PatternRow>();

  if (!pattern) {
    return c.json({ error: "Pattern not found" }, 404);
  }

  return c.json(toPatternResponse(pattern));
});

app.post("/patterns", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<CreatePatternRequest>();

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
    `INSERT INTO patterns (id, user_id, name, config_json, pattern_type, preview_r2_key, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(id, auth.userId, body.name, body.configJson, body.patternType, previewR2Key, now, now)
    .run();

  const pattern = await c.env.DB.prepare(
    "SELECT * FROM patterns WHERE id = ?1"
  )
    .bind(id)
    .first<PatternRow>();

  return c.json(toPatternResponse(pattern!), 201);
});

app.put("/patterns/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT * FROM patterns WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .first<PatternRow>();

  if (!existing) {
    return c.json({ error: "Pattern not found" }, 404);
  }

  const body = await c.req.json<UpdatePatternRequest>();
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
    `UPDATE patterns SET name = ?1, config_json = ?2, pattern_type = ?3, preview_r2_key = ?4, updated_at = ?5
     WHERE id = ?6 AND user_id = ?7`
  )
    .bind(name, configJson, patternType, previewR2Key, now, id, auth.userId)
    .run();

  const updated = await c.env.DB.prepare(
    "SELECT * FROM patterns WHERE id = ?1"
  )
    .bind(id)
    .first<PatternRow>();

  return c.json(toPatternResponse(updated!));
});

app.delete("/patterns/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const pattern = await c.env.DB.prepare(
    "SELECT * FROM patterns WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .first<PatternRow>();

  if (!pattern) {
    return c.json({ error: "Pattern not found" }, 404);
  }

  // Delete preview from R2 if exists
  if (pattern.preview_r2_key) {
    await c.env.FILES.delete(pattern.preview_r2_key);
  }

  await c.env.DB.prepare(
    "DELETE FROM patterns WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .run();

  return c.json({ ok: true });
});

// ─── Files ──────────────────────────────────────────────────

app.get("/files", async (c) => {
  const auth = c.get("auth");
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const [countResult, listResult] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM files WHERE user_id = ?1"
    ).bind(auth.userId),
    c.env.DB.prepare(
      "SELECT * FROM files WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
    ).bind(auth.userId, limit, offset),
  ]);

  const total = (countResult.results[0] as { total: number }).total;
  const items = (listResult.results as FileRow[]).map(toFileResponse);

  return c.json({
    items,
    total,
    limit,
    offset,
  } satisfies PaginatedResponse<FileResponse>);
});

app.post("/files", async (c) => {
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
    `INSERT INTO files (id, user_id, r2_key, filename, content_type, size_bytes, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(id, auth.userId, r2Key, filename, mimeType, fileData.byteLength, now)
    .run();

  const row = await c.env.DB.prepare(
    "SELECT * FROM files WHERE id = ?1"
  )
    .bind(id)
    .first<FileRow>();

  return c.json(toFileResponse(row!), 201);
});

app.get("/files/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const file = await c.env.DB.prepare(
    "SELECT * FROM files WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .first<FileRow>();

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json(toFileResponse(file));
});

app.get("/files/:id/download", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const file = await c.env.DB.prepare(
    "SELECT * FROM files WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .first<FileRow>();

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  const r2Object = await c.env.FILES.get(file.r2_key);
  if (!r2Object) {
    return c.json({ error: "File not found in storage" }, 404);
  }

  return new Response(r2Object.body, {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Content-Length": file.size_bytes.toString(),
    },
  });
});

app.delete("/files/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");

  const file = await c.env.DB.prepare(
    "SELECT * FROM files WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .first<FileRow>();

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  await c.env.FILES.delete(file.r2_key);

  await c.env.DB.prepare(
    "DELETE FROM files WHERE id = ?1 AND user_id = ?2"
  )
    .bind(id, auth.userId)
    .run();

  return c.json({ ok: true });
});

export const onRequest = handle(app);
