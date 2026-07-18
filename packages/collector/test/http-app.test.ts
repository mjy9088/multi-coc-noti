import assert from "node:assert/strict";
import test from "node:test";
import { createCollectorApp } from "../src/http/app.ts";
import type { CollectorState } from "../src/services/collector-state.ts";

const state = {
  accounts: [],
  officialStates: new Map(),
  officialProfiles: new Map(),
} as unknown as CollectorState;

test("Hono collector app preserves health, CORS, authentication, and not-found transport behavior", async () => {
  const app = createCollectorApp({ state, adminToken: "secret", corsOrigin: "https://dashboard.example" });
  const health = await app.request("/health", { headers: { Origin: "https://dashboard.example" } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), "https://dashboard.example");
  assert.deepEqual(await health.json(), { ok: true, accounts: 0, database: true, adminConfigured: true });

  assert.equal((await app.request("/api/admin/accounts")).status, 401);
  assert.equal((await app.request("/api/admin/accounts", { headers: { Authorization: "Bearer wrong" } })).status, 401);
  assert.equal(
    (
      await app.request("/api/admin/accounts/not-a-uuid", {
        method: "DELETE",
        headers: { Authorization: "Bearer secret" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await app.request("/api/admin/upgrades/not-a-number/alerts", {
        method: "PATCH",
        headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
        body: JSON.stringify({ resourcePreparationOverrideMinutes: null }),
      })
    ).status,
    404,
  );
  assert.equal((await app.request("/missing")).status, 404);
});

test("Hono collector app reports missing admin configuration before authentication", async () => {
  const app = createCollectorApp({ state, adminToken: "", corsOrigin: "*" });
  assert.equal((await app.request("/api/admin/accounts")).status, 503);
});
