import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { CollectorState } from "../services/collector-state.ts";
import { authenticatedUser } from "./auth.ts";
import { registerReadRoutes } from "./routes/read-routes.ts";
import { registerSettingsRoutes } from "./routes/settings-routes.ts";

export type CollectorAppOptions = {
  state: CollectorState;
  corsOrigin: string;
  authenticate?: typeof authenticatedUser;
};

export function createCollectorApp({ state, corsOrigin, authenticate = authenticatedUser }: CollectorAppOptions): Hono {
  const app = new Hono();
  app.use(
    "*",
    cors({
      origin: corsOrigin === "*" ? (origin) => origin : corsOrigin,
      credentials: true,
      allowHeaders: ["content-type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({ maxSize: 2 * 1024 * 1024, onError: (c) => c.json({ error: "payload too large" }, 413) }),
  );
  app.use("/api/*", async (c, next) => {
    const user = await authenticate(c);
    if (!user) return c.json({ error: "authentication required" }, 401);
    c.set("userId" as never, user.id as never);
    await state.refreshAccounts();
    await next();
  });
  app.onError((error, c) => c.json({ error: error.message }, 400));
  app.notFound((c) => c.json({ error: "not found" }, 404));

  registerReadRoutes(app, state);
  registerSettingsRoutes(app, state);
  return app;
}
