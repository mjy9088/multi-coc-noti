import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import {
  cleanupDatabaseLogs, clearLegacyIndex, completeDueTrackedUpgrades, createAccount, deleteAccount,
  getDashboardSettings, listAccounts, listTrackedUpgrades, listLatestSnapshotLogs, listLatestVillageExports, listSnapshotHistoryLogs, migrate, saveVillageExport,
  syncTrackedUpgrades, updateAccount, updateAccountResourceStatus, updateDashboardSettings,
  updateUpgradePreparationOverride,
} from "@multi-coc/database";
import { dataDir, isUpgradeActive, isVillageRefreshRequired, normalizeAccountTags, normalizeSnapshot, readJson } from "@multi-coc/shared";
import type { Account, ResourceStatus, VillageSnapshot } from "@multi-coc/shared";
import { fetchPlayerProfile, mergeOfficialProfile } from "./clash-api.ts";
import type { PlayerProfile } from "./clash-api.ts";
import { cleanupRetention } from "./storage.ts";
import { normalizePlayerTag, parseVillageExport } from "./village-export.ts";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const profileRefreshInterval = Number(process.env.PROFILE_REFRESH_INTERVAL_SECONDS || 300) * 1000;
const snapshotRetentionDays = Number(process.env.SNAPSHOT_RETENTION_DAYS || 90);
const adminToken = process.env.ADMIN_TOKEN || "";
const root = dataDir();
type OfficialState = { configured: boolean; lastAttemptAt: string | null; lastSuccessAt: string | null; lastError: string | null };
type RequestValue = Record<string, unknown>;
const officialStates = new Map<string, OfficialState>();
const officialProfiles = new Map<string, PlayerProfile>();
let accounts: Account[] = [];

await migrate();
await mkdir(path.join(root, "accounts"), { recursive: true });
await refreshAccounts();
await migrateLegacyDataDirectories();

const cors = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function equalSecret(a = "", b = ""): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearer(request: IncomingMessage): string { return request.headers.authorization?.replace(/^Bearer\s+/i, "") || ""; }

function requireAdmin(request: IncomingMessage, response: ServerResponse): boolean {
  if (!adminToken) { json(response, 503, { error: "ADMIN_TOKEN is not configured" }); return false; }
  if (!equalSecret(String(bearer(request)), adminToken)) { json(response, 401, { error: "invalid admin token" }); return false; }
  return true;
}

async function body(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 2_000_000) throw new Error("payload too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function requestJson(request: IncomingMessage): Promise<RequestValue> {
  const text = await body(request);
  return text ? JSON.parse(text) as RequestValue : {};
}

async function refreshAccounts(): Promise<void> {
  accounts = await listAccounts();
  for (const account of accounts) {
    const configured = Boolean(account.playerTag && process.env.CLASH_OF_CLANS_API_TOKEN);
    if (!officialStates.has(account.id)) officialStates.set(account.id, { configured, lastAttemptAt: null, lastSuccessAt: null, lastError: null });
    else officialStates.get(account.id)!.configured = configured;
  }
}

async function migrateLegacyDataDirectories(): Promise<void> {
  let changed = false;
  for (const account of accounts.filter((item) => item.legacyIndex != null)) {
    const from = path.join(root, "accounts", String(account.legacyIndex));
    const to = path.join(root, "accounts", account.id);
    try {
      await rename(from, to);
      await clearLegacyIndex(account.id);
      changed = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await clearLegacyIndex(account.id);
        changed = true;
      } else if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      else console.warn(`[collector] both legacy and UUID data directories exist for ${account.label}; keeping both for manual review`);
    }
  }
  if (changed) await refreshAccounts();
}

async function refreshOfficialProfile(account: Account): Promise<void> {
  const state = officialStates.get(account.id);
  if (!state?.configured) return;
  state.lastAttemptAt = new Date().toISOString();
  try {
    const profile = await fetchPlayerProfile(account);
    if (profile) officialProfiles.set(account.id, profile);
    Object.assign(state, { lastSuccessAt: new Date().toISOString(), lastError: null });
  } catch (error) { state.lastError = (error as Error).message; console.error(`[collector] ${account.id} official API: ${(error as Error).message}`); }
}

async function dashboard(): Promise<{ generatedAt: string; accounts: VillageSnapshot[]; groupOrder: string[] }> {
  const tracked = await listTrackedUpgrades();
  const exports = new Map((await listLatestVillageExports()).map((item) => [item.accountId, item]));
  const databaseSnapshots = new Map((await listLatestSnapshotLogs()).map((item) => [item.accountId, item.snapshot]));
  const result = await Promise.all(accounts.map(async (account) => {
    const fileSnapshot = await readJson<VillageSnapshot>(path.join(root, "accounts", account.id, "latest.json"));
    const databaseSnapshot = databaseSnapshots.get(account.id);
    const stored = databaseSnapshot && (!fileSnapshot || new Date(databaseSnapshot.lastSeen) > new Date(fileSnapshot.lastSeen)) ? databaseSnapshot : fileSnapshot;
    const villageExport = exports.get(account.id)?.normalized;
    const accountUpgrades = tracked.filter((upgrade) => upgrade.accountId === account.id);
    const latest: VillageSnapshot = stored || {
      id: account.id, name: account.label, tag: account.playerTag, townHall: 0, level: 0, color: account.color,
      tags: account.tags,
      dataSource: "unavailable", online: false, lastSeen: new Date().toISOString(), builders: { free: 0, total: 0 },
      resources: null, upgrades: [],
    };
    if (villageExport && (!stored || new Date(villageExport.exportedAt) >= new Date(stored.lastSeen))) {
      const knownHomeBuilderTasks = villageExport.upgrades.filter((upgrade) => upgrade.base === "home" && (upgrade.type === "building" || upgrade.type === "hero")).length;
      const activeHomeBuilderTasks = villageExport.upgrades.filter((upgrade) => upgrade.base === "home" && (upgrade.type === "building" || upgrade.type === "hero") && isUpgradeActive(upgrade)).length;
      const builders = {
        total: Math.max(villageExport.builders.total, knownHomeBuilderTasks),
        free: Math.max(0, Math.max(villageExport.builders.total, knownHomeBuilderTasks) - activeHomeBuilderTasks),
        regularTotal: villageExport.builders.regularTotal ?? villageExport.builders.total,
      };
      const builderBase = villageExport.upgradeSlots?.builderBase;
      const laboratory = villageExport.upgradeSlots?.laboratory;
      const knownHomeResearch = villageExport.upgrades.filter((upgrade) => upgrade.base === "home" && upgrade.type === "research").length;
      const activeHomeResearch = villageExport.upgrades.filter((upgrade) => upgrade.base === "home" && upgrade.type === "research" && isUpgradeActive(upgrade)).length;
      const homeLaboratoryBusy = villageExport.upgrades.some((upgrade) => upgrade.base === "home" && upgrade.dataId === 1000007 && isUpgradeActive(upgrade));
      const knownBuilderBaseTasks = villageExport.upgrades.filter((upgrade) => upgrade.base === "builder" && upgrade.type !== "research").length;
      const activeBuilderBaseTasks = villageExport.upgrades.filter((upgrade) => upgrade.base === "builder" && upgrade.type !== "research" && isUpgradeActive(upgrade)).length;
      const builderLaboratory = builderBase?.laboratory;
      const knownBuilderResearch = villageExport.upgrades.filter((upgrade) => upgrade.base === "builder" && upgrade.type === "research").length;
      const activeBuilderResearch = villageExport.upgrades.filter((upgrade) => upgrade.base === "builder" && upgrade.type === "research" && isUpgradeActive(upgrade)).length;
      const builderLaboratoryBusy = villageExport.upgrades.some((upgrade) => upgrade.base === "builder" && upgrade.dataId === 1000046 && isUpgradeActive(upgrade));
      const upgradeSlots = villageExport.upgradeSlots ? {
        ...villageExport.upgradeSlots,
        laboratory: laboratory ? {
          ...laboratory,
          available: activeHomeResearch === 0 && !homeLaboratoryBusy,
          active: activeHomeResearch,
          total: Math.max(laboratory.total || 1, knownHomeResearch),
        } : null,
        builderBase: builderBase ? {
          ...builderBase,
          builders: {
            total: Math.max(builderBase.builders.total, knownBuilderBaseTasks),
            free: Math.max(0, Math.max(builderBase.builders.total, knownBuilderBaseTasks) - activeBuilderBaseTasks),
          },
          laboratory: builderLaboratory ? {
            ...builderLaboratory,
            available: activeBuilderResearch === 0 && !builderLaboratoryBusy,
            active: activeBuilderResearch,
            total: Math.max(builderLaboratory.total || 1, knownBuilderResearch),
          } : null,
        } : null,
      } : undefined;
      Object.assign(latest, {
        tag: villageExport.tag, townHall: villageExport.townHall || latest.townHall,
        builders, upgradeSlots, upgrades: villageExport.upgrades,
        lastSeen: villageExport.exportedAt, dataSource: "game-export", online: true,
      });
    }
    const upgrades = accountUpgrades.filter((upgrade) => isUpgradeActive(upgrade));
    const refreshCompletion = accountUpgrades.filter((upgrade) => {
      return isVillageRefreshRequired(latest.lastSeen, upgrade.finishAt);
    }).sort((a, b) => +new Date(b.finishAt) - +new Date(a.finishAt))[0];
    return mergeOfficialProfile({ ...latest, id: account.id, color: account.color, tags: account.tags, upgrades,
      refreshRequired: Boolean(refreshCompletion), refreshCompletedAt: refreshCompletion?.finishAt || null,
      online: Boolean(stored || villageExport) }, officialProfiles.get(account.id));
  }));
  const { groupOrder } = await getDashboardSettings();
  return { generatedAt: new Date().toISOString(), accounts: result, groupOrder };
}

function accountInput(value: RequestValue, existing: Account | null): Omit<Account, "id" | "legacyIndex"> {
  const label = String(value.label || "").trim();
  if (!label) throw new Error("label is required");
  const playerTag = normalizePlayerTag(value.playerTag || existing?.playerTag);
  const resourceStatus = value.resourceStatus == null ? existing?.resourceStatus || "unanswered" : String(value.resourceStatus);
  if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(resourceStatus)) throw new Error("invalid resource status");
  const preparationValue = value.resourcePreparationMinutes === undefined ? existing?.resourcePreparationMinutes ?? 60 : value.resourcePreparationMinutes;
  const resourcePreparationMinutes = preparationValue === null ? null : Number(preparationValue);
  if (resourcePreparationMinutes != null && (!Number.isInteger(resourcePreparationMinutes) || resourcePreparationMinutes < 1 || resourcePreparationMinutes > 525_600)) {
    throw new Error("resource preparation time must be whole minutes from 1 to 525600, or disabled");
  }
  return {
    label, playerTag,
    color: String(value.color || existing?.color || "#4c9a79"), tags: normalizeAccountTags(value.tags, existing?.tags),
    resourceStatus: resourceStatus as ResourceStatus,
    resourceStatusUpdatedAt: existing?.resourceStatusUpdatedAt || new Date().toISOString(), resourcePreparationMinutes,
  };
}

function previewVillageExport(value: RequestValue) {
  const parsed = parseVillageExport(value.export ?? value.exportText ?? value);
  const account = accounts.find((item) => item.playerTag === parsed.tag);
  return {
    parsed,
    preview: {
      tag: parsed.tag, exportedAt: parsed.exportedAt, townHall: parsed.townHall, builders: parsed.builders,
      upgradeSlots: parsed.upgradeSlots,
      upgrades: parsed.upgrades.map(({ id, name, type, base, level, nextLevel, finishAt }) => ({ id, name, type, base, level, nextLevel, finishAt })),
      unknownDataIds: parsed.unknownDataIds,
      account: account ? { id: account.id, label: account.label, color: account.color } : null,
      isNew: !account,
    },
  };
}

async function importVillageExport(value: RequestValue) {
  const { parsed } = previewVillageExport(value);
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
  return { account: { id: account.id, label: account.label }, created, exportedAt: parsed.exportedAt, upgrades: parsed.upgrades.length, builders: parsed.builders, unknownDataIds: parsed.unknownDataIds };
}

async function completeDue(): Promise<void> {
  await completeDueTrackedUpgrades();
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "OPTIONS") { response.writeHead(204, cors); return response.end(); }
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true, accounts: accounts.length, database: true, adminConfigured: Boolean(adminToken), retention: { snapshots: snapshotRetentionDays } });
    if (request.method === "GET" && url.pathname === "/api/sources") return json(response, 200, { accounts: accounts.map((account) => ({ id: account.id, label: account.label, official: officialStates.get(account.id) })) });
    if (request.method === "GET" && url.pathname === "/api/dashboard") return json(response, 200, await dashboard());
    if (request.method === "GET" && url.pathname === "/api/history") {
      const account = accounts.find((item) => item.id === url.searchParams.get("account"));
      if (!account) return json(response, 404, { error: "unknown account" });
      const limit = Math.max(1, Math.min(500, Math.floor(Number(url.searchParams.get("limit") || 100)) || 100));
      const records = await listSnapshotHistoryLogs(account.id, limit);
      return json(response, 200, { account: { id: account.id, name: account.label }, snapshots: records.map((record) => record.snapshot || normalizeSnapshot(account, record.source || {})) });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(request, response)) return;
      if (request.method === "GET" && url.pathname === "/api/admin/accounts") return json(response, 200, { accounts: accounts.map(({ legacyIndex, ...account }) => account) });
      if (request.method === "GET" && url.pathname === "/api/admin/dashboard-settings") return json(response, 200, await getDashboardSettings());
      if (request.method === "PATCH" && url.pathname === "/api/admin/dashboard-settings") {
        const value = await requestJson(request);
        if (Object.keys(value).some((key) => key !== "groupOrder")) throw new Error("only groupOrder can be changed");
        return json(response, 200, await updateDashboardSettings(normalizeAccountTags(value.groupOrder)));
      }
      if (request.method === "POST" && url.pathname === "/api/admin/accounts") {
        const account = await createAccount(accountInput(await requestJson(request), null)); await refreshAccounts();
        await refreshOfficialProfile(account);
        return json(response, 201, { account: { id: account.id, label: account.label, playerTag: account.playerTag, color: account.color, tags: account.tags } });
      }
      const accountPath = url.pathname.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})$/i);
      const resourceStatusPath = url.pathname.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})\/resource-status$/i);
      if (request.method === "PATCH" && resourceStatusPath) {
        const value = await requestJson(request);
        if (Object.keys(value).some((key) => key !== "resourceStatus")) throw new Error("only resourceStatus can be changed");
        const status = String(value.resourceStatus || "");
        if (!["abundant", "sufficient", "insufficient", "unanswered"].includes(status)) throw new Error("invalid resource status");
        const account = await updateAccountResourceStatus(resourceStatusPath[1], status as ResourceStatus);
        if (!account) return json(response, 404, { error: "unknown account" });
        await refreshAccounts();
        return json(response, 200, { account: { id: account.id, resourceStatus: account.resourceStatus, resourceStatusUpdatedAt: account.resourceStatusUpdatedAt } });
      }
      if (request.method === "PATCH" && accountPath) {
        const existing = accounts.find((item) => item.id === accountPath[1]);
        if (!existing) return json(response, 404, { error: "unknown account" });
        const account = await updateAccount(existing.id, accountInput(await requestJson(request), existing));
        if (!account) return json(response, 404, { error: "unknown account" });
        await refreshAccounts();
        await refreshOfficialProfile(account);
        return json(response, 200, { account: { id: account.id, label: account.label, playerTag: account.playerTag, color: account.color, tags: account.tags } });
      }
      if (request.method === "DELETE" && accountPath) { await deleteAccount(accountPath[1]); await refreshAccounts(); return json(response, 200, { deleted: true }); }
      if (request.method === "GET" && url.pathname === "/api/admin/upgrades") return json(response, 200, { upgrades: await listTrackedUpgrades() });
      const upgradeAlertPath = url.pathname.match(/^\/api\/admin\/upgrades\/(\d+)\/alerts$/);
      if (request.method === "PATCH" && upgradeAlertPath) {
        const value = await requestJson(request);
        if (Object.keys(value).some((key) => key !== "resourcePreparationOverrideMinutes")) throw new Error("only resourcePreparationOverrideMinutes can be changed");
        const raw = value.resourcePreparationOverrideMinutes;
        const overrideMinutes = raw === null ? null : Number(raw);
        if (overrideMinutes !== null && (!Number.isInteger(overrideMinutes) || overrideMinutes < 0 || overrideMinutes > 525_600)) throw new Error("upgrade preparation override must be whole minutes from 0 to 525600, or null");
        const upgrade = await updateUpgradePreparationOverride(upgradeAlertPath[1], overrideMinutes);
        if (!upgrade) return json(response, 404, { error: "unknown upgrade" });
        return json(response, 200, { upgrade });
      }
      if (request.method === "POST" && url.pathname === "/api/admin/village-export/preview") {
        const { preview } = previewVillageExport(await requestJson(request));
        return json(response, 200, preview);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/village-export") return json(response, 201, await importVillageExport(await requestJson(request)));
    }

    json(response, 404, { error: "not found" });
  } catch (error) { const message = (error as Error).message; json(response, message === "payload too large" ? 413 : 400, { error: message }); }
});

function json(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(value));
}

await Promise.all(accounts.map((account) => refreshOfficialProfile(account)));
setInterval(() => accounts.forEach((account) => { refreshOfficialProfile(account); }), profileRefreshInterval).unref();
await completeDue();
setInterval(completeDue, Math.min(profileRefreshInterval, 60_000)).unref();
const clean = () => Promise.all([
  cleanupRetention(root, accounts.map((account) => account.id), { snapshotDays: snapshotRetentionDays }),
  cleanupDatabaseLogs({ snapshotDays: snapshotRetentionDays }),
]).catch((error: Error) => console.error(`[collector] retention: ${error.message}`));
await clean(); setInterval(clean, 6 * 60 * 60 * 1000).unref();
server.listen(port, host, () => console.log(`[collector] listening on ${host}:${port}`));
