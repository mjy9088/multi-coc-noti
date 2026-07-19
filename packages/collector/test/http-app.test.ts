import assert from "node:assert/strict";
import test from "node:test";
import { createCollectorApp } from "../src/http/app.ts";
import type { CollectorState } from "../src/services/collector-state.ts";

const state = {
  accounts: [],
  accountsFor: () => [],
  officialStates: new Map(),
  officialProfiles: new Map(),
} as unknown as CollectorState;

test("Hono collector app preserves health, CORS, session authentication, and route matching", async () => {
  const app = createCollectorApp({
    state,
    corsOrigin: "https://dashboard.example",
    authenticate: async (c) =>
      c.req.header("cookie") === "authjs.session-token=valid"
        ? { id: "user-1", name: null, email: null, image: null }
        : null,
  });
  const health = await app.request("/health", { headers: { Origin: "https://dashboard.example" } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("access-control-allow-origin"), "https://dashboard.example");
  assert.deepEqual(await health.json(), { ok: true, database: true });

  assert.equal((await app.request("/api/villages")).status, 401);
  assert.equal((await app.request("/api/villages", { headers: { Cookie: "authjs.session-token=valid" } })).status, 200);
  assert.equal(
    (
      await app.request("/api/villages/not-a-uuid", {
        method: "DELETE",
        headers: { Cookie: "authjs.session-token=valid" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await app.request("/api/settings/upgrades/not-a-number/alerts", {
        method: "PATCH",
        headers: { Cookie: "authjs.session-token=valid", "Content-Type": "application/json" },
        body: JSON.stringify({ resourcePreparationOverrideMinutes: null }),
      })
    ).status,
    404,
  );
});
