import {
  createAccount,
  deleteAccount,
  deleteNotificationChannel,
  getDashboardSettings,
  listNotificationChannels,
  listTrackedUpgrades,
  saveBarkChannel,
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
import { requestUserId } from "../auth.ts";

type RequestValue = VillageExportInput;

export function registerUserRoutes(app: Hono, state: CollectorState): void {
  app.get("/api/notification-channels", async (c) =>
    c.json({ channels: await listNotificationChannels(requestUserId(c)) }),
  );
  app.post("/api/notification-channels", async (c) => {
    const input = barkChannelInput(await c.req.json<RequestValue>());
    return c.json({ channel: await saveBarkChannel(requestUserId(c), input) }, 201);
  });
  app.patch("/api/notification-channels/:id{[0-9a-fA-F-]{36}}", async (c) => {
    const input = barkChannelInput(await c.req.json<RequestValue>());
    const channel = await saveBarkChannel(requestUserId(c), input, c.req.param("id"));
    return channel ? c.json({ channel }) : c.json({ error: "unknown notification channel" }, 404);
  });
  app.delete("/api/notification-channels/:id{[0-9a-fA-F-]{36}}", async (c) => {
    const deleted = await deleteNotificationChannel(requestUserId(c), c.req.param("id"));
    return deleted ? c.json({ deleted: true }) : c.json({ error: "unknown notification channel" }, 404);
  });
  app.get("/api/villages", (c) =>
    c.json({
      accounts: state.accountsFor(requestUserId(c)).map(({ legacyIndex, userId: _userId, ...account }) => account),
    }),
  );
  app.get("/api/settings/dashboard", async (c) => c.json(await getDashboardSettings(requestUserId(c))));
  app.patch("/api/settings/dashboard", async (c) => {
    const value = await c.req.json<RequestValue>();
    if (Object.keys(value).some((key) => key !== "groupOrder")) throw new Error("only groupOrder can be changed");
    return c.json(await updateDashboardSettings(requestUserId(c), normalizeAccountTags(value.groupOrder)));
  });
  app.post("/api/villages", async (c) => {
    const account = await createAccount(accountInput(await c.req.json<RequestValue>(), null), requestUserId(c));
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
  app.patch("/api/villages/:id{[0-9a-fA-F-]{36}}/resource-status", async (c) => {
    const value = await c.req.json<RequestValue>();
    if (Object.keys(value).some((key) => key !== "resourceStatus"))
      throw new Error("only resourceStatus can be changed");
    const status = String(value.resourceStatus || "");
    if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(status))
      throw new Error("invalid resource status");
    const account = await updateAccountResourceStatus(c.req.param("id"), status as ResourceStatus, requestUserId(c));
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
  app.patch("/api/villages/:id{[0-9a-fA-F-]{36}}", async (c) => {
    const userId = requestUserId(c);
    const existing = state.accountsFor(userId).find((item) => item.id === c.req.param("id"));
    if (!existing) return c.json({ error: "unknown account" }, 404);
    const account = await updateAccount(existing.id, accountInput(await c.req.json<RequestValue>(), existing), userId);
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
  app.delete("/api/villages/:id{[0-9a-fA-F-]{36}}", async (c) => {
    const deleted = await deleteAccount(c.req.param("id"), requestUserId(c));
    if (!deleted) return c.json({ error: "unknown account" }, 404);
    await state.refreshAccounts();
    return c.json({ deleted: true });
  });
  app.get("/api/settings/upgrades", async (c) =>
    c.json({
      upgrades: await listTrackedUpgrades({ accountIds: state.accountsFor(requestUserId(c)).map(({ id }) => id) }),
    }),
  );
  app.patch("/api/settings/upgrades/:id{[0-9]+}/alerts", async (c) => {
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
    const upgrade = await updateUpgradePreparationOverride(c.req.param("id"), overrideMinutes, requestUserId(c));
    return upgrade ? c.json({ upgrade }) : c.json({ error: "unknown upgrade" }, 404);
  });
  app.post("/api/village-exports/preview", async (c) => {
    const { preview } = await previewVillageExport(state, requestUserId(c), await c.req.json<RequestValue>());
    return c.json(preview);
  });
  app.post("/api/village-exports", async (c) =>
    c.json(await importVillageExport(state, requestUserId(c), await c.req.json<RequestValue>()), 201),
  );
}

function barkChannelInput(value: RequestValue): {
  label: string;
  enabled: boolean;
  locale: "ko" | "en";
  baseUrl: string;
  deviceKey: string | undefined;
  defaultGroup: string | null;
  iconUrl: string | null;
} {
  const label = String(value.label || "").trim();
  const baseUrl = String(value.baseUrl || "https://api.day.app").replace(/\/$/, "");
  const locale = value.locale === "en" ? "en" : "ko";
  if (!label) throw new Error("channel label is required");
  if (!/^https?:\/\//.test(baseUrl)) throw new Error("Bark base URL must use HTTP or HTTPS");
  return {
    label,
    enabled: value.enabled !== false,
    locale,
    baseUrl,
    deviceKey: value.deviceKey == null ? undefined : String(value.deviceKey).trim(),
    defaultGroup: value.defaultGroup == null ? null : String(value.defaultGroup).trim() || null,
    iconUrl: value.iconUrl == null ? null : String(value.iconUrl).trim() || null,
  };
}
