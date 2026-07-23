import { listSyncHistory, listUpgradeHistory } from "@multi-coc/database";
import type { Context, Hono } from "hono";
import type { CollectorState } from "../../services/collector-state.ts";
import { getDashboard } from "../../use-cases/get-dashboard.ts";
import { requestUserId } from "../auth.ts";

export function registerReadRoutes(app: Hono, state: CollectorState): void {
  app.get("/health", (c) => c.json({ ok: true, database: true }));
  app.get("/api/sources", (c) =>
    c.json({
      accounts: state.accountsFor(requestUserId(c)).map((account) => ({
        id: account.id,
        label: account.label,
        official: state.officialStates.get(account.id),
      })),
    }),
  );
  app.get("/api/dashboard", async (c) => c.json(await getDashboard(state, requestUserId(c))));
  app.get("/api/upgrades", (c) => upgradeHistory(c, state));
  app.get("/api/villages/:id{[0-9a-fA-F-]{36}}/upgrades", (c) => upgradeHistory(c, state, c.req.param("id")));
  app.get("/api/syncs", async (c) => {
    const accounts = state.accountsFor(requestUserId(c));
    const villageId = c.req.query("village") || undefined;
    if (villageId && !accounts.some((item) => item.id === villageId)) return c.json({ error: "unknown account" }, 404);
    const limit = boundedLimit(c.req.query("limit"));
    const syncs = await listSyncHistory({
      accountId: villageId,
      accountIds: accounts.map(({ id }) => id),
      limit,
      before: c.req.query("before") || undefined,
    });
    return c.json({
      villages: villages(accounts),
      syncs,
      nextBefore: syncs.length === limit ? syncs.at(-1)?.id || null : null,
    });
  });
}

async function upgradeHistory(c: Context, state: CollectorState, pathAccountId?: string) {
  const accounts = state.accountsFor(requestUserId(c));
  const pathAccount = pathAccountId ? accounts.find((item) => item.id === pathAccountId) : null;
  if (pathAccountId && !pathAccount) return c.json({ error: "unknown account" }, 404);
  const villageId = pathAccount?.id || c.req.query("village") || undefined;
  if (villageId && !accounts.some((item) => item.id === villageId)) return c.json({ error: "unknown account" }, 404);
  const limit = boundedLimit(c.req.query("limit"));
  const base = c.req.query("base") || undefined;
  const activeValue = c.req.query("active");
  const type = c.req.query("type") || undefined;
  if (base && !["home", "builder"].includes(base)) throw new Error("invalid upgrade base");
  if (activeValue != null && !["true", "false"].includes(activeValue)) throw new Error("invalid active filter");
  if (type && !["building", "hero", "pet", "research"].includes(type)) throw new Error("invalid upgrade type");
  const upgrades = await listUpgradeHistory({
    accountId: villageId,
    accountIds: accounts.map(({ id }) => id),
    limit,
    before: c.req.query("before") || undefined,
    base: base as "home" | "builder" | undefined,
    active: activeValue == null ? undefined : activeValue === "true",
    type: type as "building" | "hero" | "pet" | "research" | undefined,
  });
  return c.json({
    villages: villages(accounts),
    upgrades: upgrades.map(({ status, ...upgrade }) => ({ ...upgrade, active: status === "active" })),
    nextBefore: upgrades.length === limit ? upgrades.at(-1)?.id || null : null,
  });
}

function boundedLimit(value: string | undefined): number {
  return Math.max(1, Math.min(500, Math.floor(Number(value || 100)) || 100));
}

function villages(accounts: CollectorState["accounts"]) {
  return accounts.map(({ id, label: name, playerTag, color }) => ({ id, name, playerTag, color }));
}
