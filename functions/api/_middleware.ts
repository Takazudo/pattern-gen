import { handleMiddleware } from "hono/cloudflare-pages";
import { jwtVerify } from "jose";
import type { Bindings, AuthContext } from "../types.js";

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const onRequest = handleMiddleware<{
  Bindings: Bindings;
}>(async (c, next) => {
  const env = c.env;

  // CSRF check on mutating methods
  const method = c.req.method;
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    const origin = c.req.header("Origin");
    const requestUrl = new URL(c.req.url);
    const expectedOrigin = requestUrl.origin;
    if (!origin || origin !== expectedOrigin) {
      return c.json({ error: "CSRF origin mismatch" }, 403);
    }
  }

  // Extract and verify access JWT from cookie
  const cookieHeader = c.req.header("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((pair) => {
      const [k, ...v] = pair.trim().split("=");
      return [k, v.join("=")];
    })
  );

  const accessToken = cookies["__Host-access"];
  if (!accessToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const signingKey = new TextEncoder().encode(env.APP_JWT_SECRET);
    const { payload } = await jwtVerify(accessToken, signingKey);

    const userId = payload.sub;
    const sessionId = payload.sid as string | undefined;

    if (!userId || !sessionId) {
      return c.json({ error: "Invalid token claims" }, 401);
    }

    c.set("auth", { userId, sessionId });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
});
