import { listSyncHistory, listUpgradeHistory } from "@multi-coc/database";
import type { Context, Hono } from "hono";
import type { CollectorState } from "../../services/collector-state.ts";
import { getDashboard } from "../../use-cases/get-dashboard.ts";

export function registerPublicRoutes(app: Hono, state: CollectorState, adminToken: string): void {
  app.get("/health", (c) =>
    c.json({ ok: true, accounts: state.accounts.length, database: true, adminConfigured: Boolean(adminToken) }),
  );
  app.get("/api/sources", (c) =>
    c.json({
      accounts: state.accounts.map((account) => ({
        id: account.id,
        label: account.label,
        official: state.officialStates.get(account.id),
      })),
    }),
  );
  app.get("/api/dashboard", async (c) => c.json(await getDashboard(state)));
  app.get("/api/upgrades", (c) => upgradeHistory(c, state));
  app.get("/api/villages/:id{[0-9a-fA-F-]{36}}/upgrades", (c) => upgradeHistory(c, state, c.req.param("id")));
  app.get("/api/syncs", async (c) => {
    const villageId = c.req.query("village") || undefined;
    if (villageId && !state.accounts.some((item) => item.id === villageId))
      return c.json({ error: "unknown account" }, 404);
    const limit = boundedLimit(c.req.query("limit"));
    const syncs = await listSyncHistory({
      accountId: villageId,
      limit,
      before: c.req.query("before") || undefined,
    });
    return c.json({
      villages: villages(state),
      syncs,
      nextBefore: syncs.length === limit ? syncs.at(-1)?.id || null : null,
    });
  });
}

async function upgradeHistory(c: Context, state: CollectorState, pathAccountId?: string) {
  const pathAccount = pathAccountId ? state.accounts.find((item) => item.id === pathAccountId) : null;
  if (pathAccountId && !pathAccount) return c.json({ error: "unknown account" }, 404);
  const villageId = pathAccount?.id || c.req.query("village") || undefined;
  if (villageId && !state.accounts.some((item) => item.id === villageId))
    return c.json({ error: "unknown account" }, 404);
  const limit = boundedLimit(c.req.query("limit"));
  const base = c.req.query("base") || undefined;
  const activeValue = c.req.query("active");
  const type = c.req.query("type") || undefined;
  if (base && !["home", "builder"].includes(base)) throw new Error("invalid upgrade base");
  if (activeValue != null && !["true", "false"].includes(activeValue)) throw new Error("invalid active filter");
  if (type && !["building", "hero", "pet", "research"].includes(type)) throw new Error("invalid upgrade type");
  const upgrades = await listUpgradeHistory({
    accountId: villageId,
    limit,
    before: c.req.query("before") || undefined,
    base: base as "home" | "builder" | undefined,
    active: activeValue == null ? undefined : activeValue === "true",
    type: type as "building" | "hero" | "pet" | "research" | undefined,
  });
  return c.json({
    villages: villages(state),
    upgrades: upgrades.map(({ status, ...upgrade }) => ({ ...upgrade, active: status === "active" })),
    nextBefore: upgrades.length === limit ? upgrades.at(-1)?.id || null : null,
  });
}

function boundedLimit(value: string | undefined): number {
  return Math.max(1, Math.min(500, Math.floor(Number(value || 100)) || 100));
}

function villages(state: CollectorState) {
  return state.accounts.map(({ id, label: name, playerTag, color }) => ({ id, name, playerTag, color }));
}
