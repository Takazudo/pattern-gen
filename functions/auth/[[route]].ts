import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  createRemoteJWKSet,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose";
import type { Bindings, UserRow } from "../types.js";

type HonoEnv = {
  Bindings: Bindings;
};

const app = new Hono<HonoEnv>().basePath("/auth");

// ─── Helpers ────────────────────────────────────────────────

/** Generate a cryptographically random URL-safe token */
function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 hash of a string, returned as hex */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Sign a value with HMAC-SHA256 for cookie integrity */
async function signValue(
  value: string,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${value}.${sigHex}`;
}

/** Verify a signed value and return the original value or null */
async function verifySignedValue(
  signed: string,
  secret: string
): Promise<string | null> {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.substring(0, lastDot);
  const expected = await signValue(value, secret);
  if (expected !== signed) return null;
  return value;
}

/** JWKS key set — cached per Auth0 domain in module scope */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJWKS(domain: string) {
  let jwks = jwksCache.get(domain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${domain}/.well-known/jwks.json`)
    );
    jwksCache.set(domain, jwks);
  }
  return jwks;
}

/** Encode secret string as CryptoKey for jose HS256 */
function getSigningKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Build the callback URL from the request */
function getCallbackUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.origin}/auth/callback`;
}

// ─── GET /auth/login ────────────────────────────────────────

app.get("/login", async (c) => {
  const env = c.env;
  const state = randomToken(32);
  const nonce = randomToken(32);

  // Store state + nonce in a signed transaction cookie
  const txData = JSON.stringify({ state, nonce });
  const signedTx = await signValue(txData, env.COOKIE_SECRET);

  setCookie(c, "__Host-auth0-tx", signedTx, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.AUTH0_CLIENT_ID,
    redirect_uri: getCallbackUrl(c),
    scope: "openid profile email offline_access",
    state,
    nonce,
  });

  return c.redirect(
    `https://${env.AUTH0_DOMAIN}/authorize?${params.toString()}`
  );
});

// ─── GET /auth/callback ─────────────────────────────────────

app.get("/callback", async (c) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const desc = url.searchParams.get("error_description") || error;
    return c.text(`Auth error: ${desc}`, 400);
  }

  if (!code || !returnedState) {
    return c.text("Missing code or state", 400);
  }

  // Verify transaction cookie
  const txCookie = getCookie(c, "__Host-auth0-tx");
  if (!txCookie) {
    return c.text("Missing transaction cookie", 400);
  }

  const txData = await verifySignedValue(txCookie, env.COOKIE_SECRET);
  if (!txData) {
    return c.text("Invalid transaction cookie", 400);
  }

  const { state: expectedState, nonce: expectedNonce } = JSON.parse(txData) as {
    state: string;
    nonce: string;
  };

  if (returnedState !== expectedState) {
    return c.text("State mismatch", 400);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(`https://${env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.AUTH0_CLIENT_ID,
      client_secret: env.AUTH0_CLIENT_SECRET,
      code,
      redirect_uri: getCallbackUrl(c),
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return c.text(`Token exchange failed: ${body}`, 500);
  }

  const tokens = (await tokenRes.json()) as {
    id_token: string;
    access_token: string;
    refresh_token?: string;
  };

  // Verify ID token via JWKS
  const jwks = getJWKS(env.AUTH0_DOMAIN);
  let idPayload: JWTPayload;
  try {
    const { payload } = await jwtVerify(tokens.id_token, jwks, {
      issuer: `https://${env.AUTH0_DOMAIN}/`,
      audience: env.AUTH0_CLIENT_ID,
    });
    idPayload = payload;
  } catch {
    return c.text("ID token verification failed", 400);
  }

  // Verify nonce
  if (idPayload.nonce !== expectedNonce) {
    return c.text("Nonce mismatch", 400);
  }

  const auth0Sub = idPayload.sub;
  if (!auth0Sub) {
    return c.text("Missing sub claim", 400);
  }

  const now = Date.now();
  const userId = randomToken(16);
  const sessionId = randomToken(16);
  const refreshToken = randomToken(48);
  const refreshTokenHash = await sha256(refreshToken);

  // Upsert user + create session in D1 batch
  const upsertUser = env.DB.prepare(
    `INSERT INTO users (id, auth0_sub, email, email_verified, name, picture_url, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(auth0_sub) DO UPDATE SET
       email = excluded.email,
       email_verified = excluded.email_verified,
       name = excluded.name,
       picture_url = excluded.picture_url,
       updated_at = excluded.updated_at`
  ).bind(
    userId,
    auth0Sub,
    (idPayload.email as string) || null,
    idPayload.email_verified ? 1 : 0,
    (idPayload.name as string) || null,
    (idPayload.picture as string) || null,
    now,
    now
  );

  // We need the actual user ID (might be existing user)
  const getUser = env.DB.prepare(
    "SELECT id FROM users WHERE auth0_sub = ?1"
  ).bind(auth0Sub);

  await env.DB.batch([upsertUser]);

  const userResult = await getUser.first<{ id: string }>();
  const actualUserId = userResult?.id || userId;

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const createSession = env.DB.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(
    sessionId,
    actualUserId,
    refreshTokenHash,
    now + thirtyDaysMs,
    now,
    now
  );

  await env.DB.batch([createSession]);

  // Issue access JWT (15 min)
  const accessToken = await new SignJWT({
    sub: actualUserId,
    sid: sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSigningKey(env.APP_JWT_SECRET));

  // Clear transaction cookie
  deleteCookie(c, "__Host-auth0-tx", { path: "/" });

  // Set access cookie (15 min)
  setCookie(c, "__Host-access", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 15 * 60,
  });

  // Set refresh cookie (30 days)
  setCookie(c, "__Host-refresh", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  // Redirect to app
  return c.redirect("/pj/pattern-gen/");
});

// ─── POST /auth/logout ──────────────────────────────────────

app.post("/logout", async (c) => {
  const env = c.env;

  // Revoke session in D1 if we have a valid access token
  const accessCookie = getCookie(c, "__Host-access");
  if (accessCookie) {
    try {
      const { payload } = await jwtVerify(
        accessCookie,
        getSigningKey(env.APP_JWT_SECRET)
      );
      if (payload.sid) {
        await env.DB.prepare(
          "UPDATE sessions SET revoked_at = ?1 WHERE id = ?2"
        )
          .bind(Date.now(), payload.sid as string)
          .run();
      }
    } catch {
      // Token invalid — session cleanup best effort
    }
  }

  // Clear cookies
  deleteCookie(c, "__Host-access", { path: "/" });
  deleteCookie(c, "__Host-refresh", { path: "/" });

  // Redirect to Auth0 logout
  const returnTo = new URL(c.req.url).origin + "/pj/pattern-gen/";
  const params = new URLSearchParams({
    client_id: env.AUTH0_CLIENT_ID,
    returnTo,
  });

  return c.redirect(
    `https://${env.AUTH0_DOMAIN}/v2/logout?${params.toString()}`
  );
});

// ─── POST /auth/refresh ─────────────────────────────────────

app.post("/refresh", async (c) => {
  const env = c.env;

  const refreshCookie = getCookie(c, "__Host-refresh");
  if (!refreshCookie) {
    return c.json({ error: "No refresh token" }, 401);
  }

  const refreshHash = await sha256(refreshCookie);

  // Find valid session by refresh token hash
  const session = await env.DB.prepare(
    `SELECT id, user_id, expires_at, revoked_at
     FROM sessions
     WHERE refresh_token_hash = ?1`
  )
    .bind(refreshHash)
    .first<{
      id: string;
      user_id: string;
      expires_at: number;
      revoked_at: number | null;
    }>();

  if (!session) {
    deleteCookie(c, "__Host-refresh", { path: "/" });
    return c.json({ error: "Invalid refresh token" }, 401);
  }

  const now = Date.now();

  if (session.revoked_at || session.expires_at < now) {
    deleteCookie(c, "__Host-refresh", { path: "/" });
    return c.json({ error: "Session expired or revoked" }, 401);
  }

  // Rotate refresh token
  const newRefreshToken = randomToken(48);
  const newRefreshHash = await sha256(newRefreshToken);

  await env.DB.prepare(
    `UPDATE sessions
     SET refresh_token_hash = ?1, last_seen_at = ?2
     WHERE id = ?3`
  )
    .bind(newRefreshHash, now, session.id)
    .run();

  // Issue new access JWT
  const accessToken = await new SignJWT({
    sub: session.user_id,
    sid: session.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSigningKey(env.APP_JWT_SECRET));

  // Set new cookies
  setCookie(c, "__Host-access", accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 15 * 60,
  });

  setCookie(c, "__Host-refresh", newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return c.json({ ok: true });
});

export const onRequest = handle(app);
