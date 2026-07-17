import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin();
const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NEXT_DASHBOARD_ENV_FILE) process.loadEnvFile(path.resolve(dashboardRoot, process.env.NEXT_DASHBOARD_ENV_FILE));
const allowedDevOrigins = (() => {
  const origin = process.env.CORS_ORIGIN;
  if (!origin || origin === "*") return [];
  try { return [new URL(origin).hostname]; } catch { return []; }
})();

export default withNextIntl({
  output: "standalone",
  outputFileTracingRoot: path.join(dashboardRoot, "../.."),
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
    ] }];
  },
});
