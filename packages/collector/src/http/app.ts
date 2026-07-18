import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { CollectorState } from "../services/collector-state.ts";
import { isAdminTokenAuthorized } from "./auth.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerPublicRoutes } from "./routes/public.ts";

export type CollectorAppOptions = {
  state: CollectorState;
  adminToken: string;
  corsOrigin: string;
};

export function createCollectorApp({ state, adminToken, corsOrigin }: CollectorAppOptions): Hono {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: corsOrigin,
      allowHeaders: ["authorization", "content-type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(
    "/api/admin/*",
    bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: "payload too large" }, 413) }),
  );
  app.use("/api/admin/*", async (c, next) => {
    if (!adminToken) return c.json({ error: "ADMIN_TOKEN is not configured" }, 503);
    if (!isAdminTokenAuthorized(c.req.header("authorization") || "", adminToken))
      return c.json({ error: "invalid admin token" }, 401);
    await next();
  });
  app.onError((error, c) => c.json({ error: error.message }, 400));
  app.notFound((c) => c.json({ error: "not found" }, 404));

  registerPublicRoutes(app, state, adminToken);
  registerAdminRoutes(app, state);
  return app;
}
