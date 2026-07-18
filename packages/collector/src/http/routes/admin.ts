import {
  createAccount,
  deleteAccount,
  getDashboardSettings,
  listTrackedUpgrades,
  updateAccount,
  updateAccountResourceStatus,
  updateDashboardSettings,
  updateUpgradePreparationOverride,
} from "@multi-coc/database";
import type { ResourceStatus } from "@multi-coc/shared";
import { normalizeAccountTags } from "@multi-coc/shared";
import type { Hono } from "hono";
import type { CollectorState } from "../../services/collector-state.ts";
import {
  accountInput,
  importVillageExport,
  previewVillageExport,
  type VillageExportInput,
} from "../../use-cases/village-export.ts";

type RequestValue = VillageExportInput;

export function registerAdminRoutes(app: Hono, state: CollectorState): void {
  app.get("/api/admin/accounts", (c) =>
    c.json({ accounts: state.accounts.map(({ legacyIndex, ...account }) => account) }),
  );
  app.get("/api/admin/dashboard-settings", async (c) => c.json(await getDashboardSettings()));
  app.patch("/api/admin/dashboard-settings", async (c) => {
    const value = await c.req.json<RequestValue>();
    if (Object.keys(value).some((key) => key !== "groupOrder")) throw new Error("only groupOrder can be changed");
    return c.json(await updateDashboardSettings(normalizeAccountTags(value.groupOrder)));
  });
  app.post("/api/admin/accounts", async (c) => {
    const account = await createAccount(accountInput(await c.req.json<RequestValue>(), null));
    await state.refreshAccounts();
    await state.refreshOfficialProfile(account);
    return c.json(
      {
        account: {
          id: account.id,
          label: account.label,
          playerTag: account.playerTag,
          color: account.color,
          tags: account.tags,
        },
      },
      201,
    );
  });
  app.patch("/api/admin/accounts/:id{[0-9a-fA-F-]{36}}/resource-status", async (c) => {
    const value = await c.req.json<RequestValue>();
    if (Object.keys(value).some((key) => key !== "resourceStatus"))
      throw new Error("only resourceStatus can be changed");
    const status = String(value.resourceStatus || "");
    if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(status))
      throw new Error("invalid resource status");
    const account = await updateAccountResourceStatus(c.req.param("id"), status as ResourceStatus);
    if (!account) return c.json({ error: "unknown account" }, 404);
    await state.refreshAccounts();
    return c.json({
      account: {
        id: account.id,
        resourceStatus: account.resourceStatus,
        resourceStatusUpdatedAt: account.resourceStatusUpdatedAt,
      },
    });
  });
  app.patch("/api/admin/accounts/:id{[0-9a-fA-F-]{36}}", async (c) => {
    const existing = state.accounts.find((item) => item.id === c.req.param("id"));
    if (!existing) return c.json({ error: "unknown account" }, 404);
    const account = await updateAccount(existing.id, accountInput(await c.req.json<RequestValue>(), existing));
    if (!account) return c.json({ error: "unknown account" }, 404);
    await state.refreshAccounts();
    await state.refreshOfficialProfile(account);
    return c.json({
      account: {
        id: account.id,
        label: account.label,
        playerTag: account.playerTag,
        color: account.color,
        tags: account.tags,
      },
    });
  });
  app.delete("/api/admin/accounts/:id{[0-9a-fA-F-]{36}}", async (c) => {
    await deleteAccount(c.req.param("id"));
    await state.refreshAccounts();
    return c.json({ deleted: true });
  });
  app.get("/api/admin/upgrades", async (c) => c.json({ upgrades: await listTrackedUpgrades() }));
  app.patch("/api/admin/upgrades/:id{[0-9]+}/alerts", async (c) => {
    const value = await c.req.json<RequestValue>();
    if (Object.keys(value).some((key) => key !== "resourcePreparationOverrideMinutes"))
      throw new Error("only resourcePreparationOverrideMinutes can be changed");
    const raw = value.resourcePreparationOverrideMinutes;
    const overrideMinutes = raw === null ? null : Number(raw);
    if (
      overrideMinutes !== null &&
      (!Number.isInteger(overrideMinutes) || overrideMinutes < 0 || overrideMinutes > 525_600)
    )
      throw new Error("upgrade preparation override must be whole minutes from 0 to 525600, or null");
    const upgrade = await updateUpgradePreparationOverride(c.req.param("id"), overrideMinutes);
    return upgrade ? c.json({ upgrade }) : c.json({ error: "unknown upgrade" }, 404);
  });
  app.post("/api/admin/village-export/preview", async (c) => {
    const { preview } = await previewVillageExport(state, await c.req.json<RequestValue>());
    return c.json(preview);
  });
  app.post("/api/admin/village-export", async (c) =>
    c.json(await importVillageExport(state, await c.req.json<RequestValue>()), 201),
  );
}
