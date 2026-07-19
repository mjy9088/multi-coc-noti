import { serve } from "@hono/node-server";
import { closeDatabase, completeDueTrackedUpgrades, migrate } from "@multi-coc/database";
import { createCollectorApp } from "./http/app.ts";
import { CollectorState } from "./services/collector-state.ts";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const profileRefreshInterval = Number(process.env.PROFILE_REFRESH_INTERVAL_SECONDS || 300) * 1000;
const state = new CollectorState();

await migrate();
await state.refreshAccounts();
await state.refreshAllOfficialProfiles();
await completeDueTrackedUpgrades();

const profileTimer = setInterval(() => void state.refreshAllOfficialProfiles(), profileRefreshInterval);
const completionTimer = setInterval(() => void completeDueTrackedUpgrades(), Math.min(profileRefreshInterval, 60_000));
profileTimer.unref();
completionTimer.unref();

const app = createCollectorApp({
  state,
  corsOrigin: process.env.CORS_ORIGIN || "*",
});

const server = serve({ fetch: app.fetch, port, hostname: host }, () =>
  console.log(`[collector] listening on ${host}:${port}`),
);

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(profileTimer);
  clearInterval(completionTimer);
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await closeDatabase();
  console.log(`[collector] stopped after ${signal}`);
}

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void shutdown(signal).catch((error) => {
      console.error(`[collector] shutdown: ${(error as Error).message}`);
      process.exitCode = 1;
    });
  });
