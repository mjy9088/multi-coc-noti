import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import {
  completeDueTrackedUpgrades,
  createAccount,
  deleteAccount,
  getDashboardSettings,
  latestVillageExport,
  listAccounts,
  listLatestVillageExports,
  listTrackedUpgrades,
  listUpgradeHistory,
  migrate,
  saveVillageExport,
  updateAccount,
  updateAccountResourceStatus,
  updateDashboardSettings,
  updateUpgradePreparationOverride,
} from "@multi-coc/database";
import type { Account, ResourceStatus, VillageSnapshot } from "@multi-coc/shared";
import { isUpgradeActive, isVillageRefreshRequired, normalizeAccountTags } from "@multi-coc/shared";
import {
  compareVillageExports,
  normalizePlayerTag,
  parseVillageDetails,
  parseVillageExport,
} from "@multi-coc/village-export";
import type { PlayerProfile } from "./clash-api.ts";
import { fetchPlayerProfile, mergeOfficialProfile } from "./clash-api.ts";
import { isAdminAuthorized } from "./http/auth.ts";
import { type RequestValue, requestJson } from "./http/request.ts";
import { json as writeJson } from "./http/response.ts";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const profileRefreshInterval = Number(process.env.PROFILE_REFRESH_INTERVAL_SECONDS || 300) * 1000;
const adminToken = process.env.ADMIN_TOKEN || "";
type OfficialState = {
  configured: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};
const officialStates = new Map<string, OfficialState>();
const officialProfiles = new Map<string, PlayerProfile>();
let accounts: Account[] = [];

await migrate();
await refreshAccounts();

const cors = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function requireAdmin(request: IncomingMessage, response: ServerResponse): boolean {
  if (!adminToken) {
    json(response, 503, { error: "ADMIN_TOKEN is not configured" });
    return false;
  }
  if (!isAdminAuthorized(request, adminToken)) {
    json(response, 401, { error: "invalid admin token" });
    return false;
  }
  return true;
}

async function refreshAccounts(): Promise<void> {
  accounts = await listAccounts();
  for (const account of accounts) {
    const configured = Boolean(account.playerTag && process.env.CLASH_OF_CLANS_API_TOKEN);
    if (!officialStates.has(account.id))
      officialStates.set(account.id, { configured, lastAttemptAt: null, lastSuccessAt: null, lastError: null });
    else {
      const state = officialStates.get(account.id);
      if (state) state.configured = configured;
    }
  }
}

async function refreshOfficialProfile(account: Account): Promise<void> {
  const state = officialStates.get(account.id);
  if (!state?.configured) return;
  state.lastAttemptAt = new Date().toISOString();
  try {
    const profile = await fetchPlayerProfile(account);
    if (profile) officialProfiles.set(account.id, profile);
    Object.assign(state, { lastSuccessAt: new Date().toISOString(), lastError: null });
  } catch (error) {
    state.lastError = (error as Error).message;
    console.error(`[collector] ${account.id} official API: ${(error as Error).message}`);
  }
}

async function dashboard(): Promise<{ generatedAt: string; accounts: VillageSnapshot[]; groupOrder: string[] }> {
  const tracked = await listTrackedUpgrades();
  const exports = new Map((await listLatestVillageExports()).map((item) => [item.accountId, item]));
  const result = await Promise.all(
    accounts.map(async (account) => {
      const latestExport = exports.get(account.id);
      const villageExport = latestExport?.normalized;
      const accountUpgrades = tracked.filter((upgrade) => upgrade.accountId === account.id);
      const latest: VillageSnapshot = {
        id: account.id,
        name: account.label,
        tag: account.playerTag,
        townHall: 0,
        level: 0,
        color: account.color,
        tags: account.tags,
        dataSource: "unavailable",
        online: false,
        lastSeen: new Date().toISOString(),
        builders: { free: 0, total: 0 },
        resources: null,
        upgrades: [],
      };
      if (villageExport) {
        const knownHomeBuilderTasks = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "home" && (upgrade.type === "building" || upgrade.type === "hero"),
        ).length;
        const activeHomeBuilderTasks = villageExport.upgrades.filter(
          (upgrade) =>
            upgrade.base === "home" &&
            (upgrade.type === "building" || upgrade.type === "hero") &&
            isUpgradeActive(upgrade),
        ).length;
        const builders = {
          total: Math.max(villageExport.builders.total, knownHomeBuilderTasks),
          free: Math.max(0, Math.max(villageExport.builders.total, knownHomeBuilderTasks) - activeHomeBuilderTasks),
          regularTotal: villageExport.builders.regularTotal ?? villageExport.builders.total,
        };
        const builderBase = villageExport.upgradeSlots?.builderBase;
        const laboratory = villageExport.upgradeSlots?.laboratory;
        const knownHomeResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "home" && upgrade.type === "research",
        ).length;
        const activeHomeResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "home" && upgrade.type === "research" && isUpgradeActive(upgrade),
        ).length;
        const homeLaboratoryBusy = villageExport.upgrades.some(
          (upgrade) => upgrade.base === "home" && upgrade.dataId === 1000007 && isUpgradeActive(upgrade),
        );
        const knownBuilderBaseTasks = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type !== "research",
        ).length;
        const activeBuilderBaseTasks = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type !== "research" && isUpgradeActive(upgrade),
        ).length;
        const builderLaboratory = builderBase?.laboratory;
        const knownBuilderResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type === "research",
        ).length;
        const activeBuilderResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type === "research" && isUpgradeActive(upgrade),
        ).length;
        const builderLaboratoryBusy = villageExport.upgrades.some(
          (upgrade) => upgrade.base === "builder" && upgrade.dataId === 1000046 && isUpgradeActive(upgrade),
        );
        const upgradeSlots = villageExport.upgradeSlots
          ? {
              ...villageExport.upgradeSlots,
              laboratory: laboratory
                ? {
                    ...laboratory,
                    available: activeHomeResearch === 0 && !homeLaboratoryBusy,
                    active: activeHomeResearch,
                    total: Math.max(laboratory.total || 1, knownHomeResearch),
                  }
                : null,
              builderBase: builderBase
                ? {
                    ...builderBase,
                    builders: {
                      total: Math.max(builderBase.builders.total, knownBuilderBaseTasks),
                      free: Math.max(
                        0,
                        Math.max(builderBase.builders.total, knownBuilderBaseTasks) - activeBuilderBaseTasks,
                      ),
                    },
                    laboratory: builderLaboratory
                      ? {
                          ...builderLaboratory,
                          available: activeBuilderResearch === 0 && !builderLaboratoryBusy,
                          active: activeBuilderResearch,
                          total: Math.max(builderLaboratory.total || 1, knownBuilderResearch),
                        }
                      : null,
                  }
                : null,
            }
          : undefined;
        Object.assign(latest, {
          tag: villageExport.tag,
          townHall: villageExport.townHall || latest.townHall,
          builders,
          upgradeSlots,
          ...parseVillageDetails(latestExport?.raw, Math.floor(new Date(villageExport.exportedAt).getTime() / 1000)),
          ...(villageExport.cooldowns ? { cooldowns: villageExport.cooldowns } : {}),
          ...(villageExport.helpers ? { helpers: villageExport.helpers } : {}),
          ...(villageExport.heroEquipment ? { heroEquipment: villageExport.heroEquipment } : {}),
          upgrades: villageExport.upgrades,
          lastSeen: villageExport.exportedAt,
          dataSource: "game-export",
          online: true,
        });
      }
      const upgrades = accountUpgrades.filter((upgrade) => isUpgradeActive(upgrade));
      const refreshCompletion = accountUpgrades
        .filter((upgrade) => {
          return isVillageRefreshRequired(latest.lastSeen, upgrade.finishAt);
        })
        .sort((a, b) => +new Date(b.finishAt) - +new Date(a.finishAt))[0];
      return mergeOfficialProfile(
        {
          ...latest,
          id: account.id,
          color: account.color,
          tags: account.tags,
          upgrades,
          refreshRequired: Boolean(refreshCompletion),
          refreshCompletedAt: refreshCompletion?.finishAt || null,
          online: Boolean(villageExport),
        },
        officialProfiles.get(account.id),
      );
    }),
  );
  const { groupOrder } = await getDashboardSettings();
  return { generatedAt: new Date().toISOString(), accounts: result, groupOrder };
}

function accountInput(value: RequestValue, existing: Account | null): Omit<Account, "id" | "legacyIndex"> {
  const label = String(value.label || "").trim();
  if (!label) throw new Error("label is required");
  const playerTag = normalizePlayerTag(value.playerTag || existing?.playerTag);
  const resourceStatus =
    value.resourceStatus == null ? existing?.resourceStatus || "unanswered" : String(value.resourceStatus);
  if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(resourceStatus))
    throw new Error("invalid resource status");
  const preparationValue =
    value.resourcePreparationMinutes === undefined
      ? (existing?.resourcePreparationMinutes ?? 60)
      : value.resourcePreparationMinutes;
  const resourcePreparationMinutes = preparationValue === null ? null : Number(preparationValue);
  if (
    resourcePreparationMinutes != null &&
    (!Number.isInteger(resourcePreparationMinutes) ||
      resourcePreparationMinutes < 1 ||
      resourcePreparationMinutes > 525_600)
  ) {
    throw new Error("resource preparation time must be whole minutes from 1 to 525600, or disabled");
  }
  return {
    label,
    playerTag,
    color: String(value.color || existing?.color || "#4c9a79"),
    tags: normalizeAccountTags(value.tags, existing?.tags),
    resourceStatus: resourceStatus as ResourceStatus,
    resourceStatusUpdatedAt: existing?.resourceStatusUpdatedAt || new Date().toISOString(),
    resourcePreparationMinutes,
  };
}

async function previewVillageExport(value: RequestValue) {
  const parsed = parseVillageExport(value.export ?? value.exportText ?? value);
  const account = accounts.find((item) => item.playerTag === parsed.tag);
  const previous = account ? await latestVillageExport(account.id) : null;
  const previousParsed = previous ? parseVillageExport(previous.raw, { allowHistorical: true }) : null;
  return {
    parsed,
    preview: {
      tag: parsed.tag,
      exportedAt: parsed.exportedAt,
      townHall: parsed.townHall,
      builders: parsed.builders,
      upgradeSlots: parsed.upgradeSlots,
      upgrades: parsed.upgrades.map(({ id, name, type, base, level, nextLevel, finishAt }) => ({
        id,
        name,
        type,
        base,
        level,
        nextLevel,
        finishAt,
      })),
      unknownDataIds: parsed.unknownDataIds,
      account: account ? { id: account.id, label: account.label, color: account.color } : null,
      isNew: !account,
      changes: compareVillageExports(previousParsed, parsed),
    },
  };
}

async function importVillageExport(value: RequestValue) {
  const { parsed } = await previewVillageExport(value);
  let account = accounts.find((item) => item.playerTag === parsed.tag);
  let created = false;
  if (!account) {
    const label = String(value.label || "").trim();
    if (!label) throw new Error(`label is required to add new village ${parsed.tag}`);
    account = await createAccount(accountInput({ label, playerTag: parsed.tag }, null));
    created = true;
    await refreshAccounts();
  }
  if (!account) throw new Error("failed to create village account");
  await saveVillageExport(account.id, parsed, { resourceStatus: "unanswered" });
  await refreshAccounts();
  return {
    account: { id: account.id, label: account.label },
    created,
    exportedAt: parsed.exportedAt,
    upgrades: parsed.upgrades.length,
    builders: parsed.builders,
    unknownDataIds: parsed.unknownDataIds,
  };
}

async function completeDue(): Promise<void> {
  await completeDueTrackedUpgrades();
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "OPTIONS") {
      response.writeHead(204, cors);
      return response.end();
    }
    if (request.method === "GET" && url.pathname === "/health")
      return json(response, 200, {
        ok: true,
        accounts: accounts.length,
        database: true,
        adminConfigured: Boolean(adminToken),
      });
    if (request.method === "GET" && url.pathname === "/api/sources")
      return json(response, 200, {
        accounts: accounts.map((account) => ({
          id: account.id,
          label: account.label,
          official: officialStates.get(account.id),
        })),
      });
    if (request.method === "GET" && url.pathname === "/api/dashboard") return json(response, 200, await dashboard());
    const villageUpgradeHistoryPath = url.pathname.match(/^\/api\/villages\/([0-9a-f-]{36})\/upgrades$/i);
    if (request.method === "GET" && (url.pathname === "/api/upgrades" || villageUpgradeHistoryPath)) {
      const pathAccount = villageUpgradeHistoryPath
        ? accounts.find((item) => item.id === villageUpgradeHistoryPath[1])
        : null;
      if (villageUpgradeHistoryPath && !pathAccount) return json(response, 404, { error: "unknown account" });
      const villageId = pathAccount?.id || url.searchParams.get("village") || undefined;
      if (villageId && !accounts.some((item) => item.id === villageId))
        return json(response, 404, { error: "unknown account" });
      const limit = Math.max(1, Math.min(500, Math.floor(Number(url.searchParams.get("limit") || 100)) || 100));
      const base = url.searchParams.get("base") || undefined;
      const activeValue = url.searchParams.get("active");
      const type = url.searchParams.get("type") || undefined;
      if (base && !["home", "builder"].includes(base)) throw new Error("invalid upgrade base");
      if (activeValue != null && !["true", "false"].includes(activeValue)) throw new Error("invalid active filter");
      if (type && !["building", "hero", "pet", "research"].includes(type)) throw new Error("invalid upgrade type");
      const upgrades = await listUpgradeHistory({
        accountId: villageId,
        limit,
        before: url.searchParams.get("before") || undefined,
        base: base as "home" | "builder" | undefined,
        active: activeValue == null ? undefined : activeValue === "true",
        type: type as "building" | "hero" | "pet" | "research" | undefined,
      });
      return json(response, 200, {
        villages: accounts.map(({ id, label: name, playerTag, color }) => ({ id, name, playerTag, color })),
        upgrades: upgrades.map(({ status, ...upgrade }) => ({ ...upgrade, active: status === "active" })),
        nextBefore: upgrades.length === limit ? upgrades.at(-1)?.id || null : null,
      });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(request, response)) return;
      if (request.method === "GET" && url.pathname === "/api/admin/accounts")
        return json(response, 200, { accounts: accounts.map(({ legacyIndex, ...account }) => account) });
      if (request.method === "GET" && url.pathname === "/api/admin/dashboard-settings")
        return json(response, 200, await getDashboardSettings());
      if (request.method === "PATCH" && url.pathname === "/api/admin/dashboard-settings") {
        const value = await requestJson(request);
        if (Object.keys(value).some((key) => key !== "groupOrder")) throw new Error("only groupOrder can be changed");
        return json(response, 200, await updateDashboardSettings(normalizeAccountTags(value.groupOrder)));
      }
      if (request.method === "POST" && url.pathname === "/api/admin/accounts") {
        const account = await createAccount(accountInput(await requestJson(request), null));
        await refreshAccounts();
        await refreshOfficialProfile(account);
        return json(response, 201, {
          account: {
            id: account.id,
            label: account.label,
            playerTag: account.playerTag,
            color: account.color,
            tags: account.tags,
          },
        });
      }
      const accountPath = url.pathname.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})$/i);
      const resourceStatusPath = url.pathname.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})\/resource-status$/i);
      if (request.method === "PATCH" && resourceStatusPath) {
        const value = await requestJson(request);
        if (Object.keys(value).some((key) => key !== "resourceStatus"))
          throw new Error("only resourceStatus can be changed");
        const status = String(value.resourceStatus || "");
        if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(status))
          throw new Error("invalid resource status");
        const account = await updateAccountResourceStatus(resourceStatusPath[1], status as ResourceStatus);
        if (!account) return json(response, 404, { error: "unknown account" });
        await refreshAccounts();
        return json(response, 200, {
          account: {
            id: account.id,
            resourceStatus: account.resourceStatus,
            resourceStatusUpdatedAt: account.resourceStatusUpdatedAt,
          },
        });
      }
      if (request.method === "PATCH" && accountPath) {
        const existing = accounts.find((item) => item.id === accountPath[1]);
        if (!existing) return json(response, 404, { error: "unknown account" });
        const account = await updateAccount(existing.id, accountInput(await requestJson(request), existing));
        if (!account) return json(response, 404, { error: "unknown account" });
        await refreshAccounts();
        await refreshOfficialProfile(account);
        return json(response, 200, {
          account: {
            id: account.id,
            label: account.label,
            playerTag: account.playerTag,
            color: account.color,
            tags: account.tags,
          },
        });
      }
      if (request.method === "DELETE" && accountPath) {
        await deleteAccount(accountPath[1]);
        await refreshAccounts();
        return json(response, 200, { deleted: true });
      }
      if (request.method === "GET" && url.pathname === "/api/admin/upgrades")
        return json(response, 200, { upgrades: await listTrackedUpgrades() });
      const upgradeAlertPath = url.pathname.match(/^\/api\/admin\/upgrades\/(\d+)\/alerts$/);
      if (request.method === "PATCH" && upgradeAlertPath) {
        const value = await requestJson(request);
        if (Object.keys(value).some((key) => key !== "resourcePreparationOverrideMinutes"))
          throw new Error("only resourcePreparationOverrideMinutes can be changed");
        const raw = value.resourcePreparationOverrideMinutes;
        const overrideMinutes = raw === null ? null : Number(raw);
        if (
          overrideMinutes !== null &&
          (!Number.isInteger(overrideMinutes) || overrideMinutes < 0 || overrideMinutes > 525_600)
        )
          throw new Error("upgrade preparation override must be whole minutes from 0 to 525600, or null");
        const upgrade = await updateUpgradePreparationOverride(upgradeAlertPath[1], overrideMinutes);
        if (!upgrade) return json(response, 404, { error: "unknown upgrade" });
        return json(response, 200, { upgrade });
      }
      if (request.method === "POST" && url.pathname === "/api/admin/village-export/preview") {
        const { preview } = await previewVillageExport(await requestJson(request));
        return json(response, 200, preview);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/village-export")
        return json(response, 201, await importVillageExport(await requestJson(request)));
    }

    json(response, 404, { error: "not found" });
  } catch (error) {
    const message = (error as Error).message;
    json(response, message === "payload too large" ? 413 : 400, { error: message });
  }
});

function json(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  writeJson(response, status, value, { ...cors, ...headers });
}

await Promise.all(accounts.map((account) => refreshOfficialProfile(account)));
setInterval(
  () =>
    accounts.forEach((account) => {
      refreshOfficialProfile(account);
    }),
  profileRefreshInterval,
).unref();
await completeDue();
setInterval(completeDue, Math.min(profileRefreshInterval, 60_000)).unref();
server.listen(port, host, () => console.log(`[collector] listening on ${host}:${port}`));
