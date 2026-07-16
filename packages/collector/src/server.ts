import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  clearLegacyIndex, completeDueManualUpgrades, createAccount, createManualUpgrade, deleteAccount, listAccounts,
  listManualUpgrades, listLatestVillageExports, migrate, saveVillageExport, setManualUpgradeStatus,
  updateAccount, updateManualUpgrade,
} from "@multi-coc/database";
import type { ManualUpgrade } from "@multi-coc/database";
import { completionEvents, dataDir, isUpgradeActive, normalizeSnapshot, parseSnapshotDocuments, readJson, writeJson } from "@multi-coc/shared";
import type { Account, SnapshotDocument, UpgradeType, VillageSnapshot } from "@multi-coc/shared";
import { fetchPlayerProfile, mergeOfficialProfile } from "./clash-api.ts";
import type { PlayerProfile } from "./clash-api.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { appendEventRecord, appendSnapshotRecord, cleanupRetention, readSnapshotHistory } from "./storage.ts";
import { normalizePlayerTag, parseVillageExport } from "./village-export.ts";

const port = Number(process.env.PORT || 8787);
const interval = Number(process.env.POLL_INTERVAL_SECONDS || 300) * 1000;
const ingestLimit = Number(process.env.INGEST_RATE_LIMIT_PER_MINUTE || 120);
const snapshotRetentionDays = Number(process.env.SNAPSHOT_RETENTION_DAYS || 90);
const eventRetentionDays = Number(process.env.EVENT_RETENTION_DAYS || 90);
const adminToken = process.env.ADMIN_TOKEN || "";
const root = dataDir();
type PollState = { configured: boolean; lastAttemptAt: string | null; lastSuccessAt: string | null; lastError: string | null; accepted: number };
type OfficialState = Omit<PollState, "accepted">;
type RequestValue = Record<string, unknown>;
const pollStates = new Map<string, PollState>();
const officialStates = new Map<string, OfficialState>();
const officialProfiles = new Map<string, PlayerProfile>();
let accounts: Account[] = [];

await migrate();
await mkdir(path.join(root, "accounts"), { recursive: true });
await refreshAccounts();
await migrateLegacyDataDirectories();
const consumeIngest = createRateLimiter({ limit: Number.isFinite(ingestLimit) && ingestLimit > 0 ? ingestLimit : 120 });

const cors = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key, x-data-origin",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function equalSecret(a = "", b = ""): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearer(request: IncomingMessage): string {
  const apiKey = request.headers["x-api-key"];
  return request.headers.authorization?.replace(/^Bearer\s+/i, "") || (Array.isArray(apiKey) ? apiKey[0] : apiKey) || "";
}

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
    if (!pollStates.has(account.id)) pollStates.set(account.id, { configured: Boolean(account.sourceUrl), lastAttemptAt: null, lastSuccessAt: null, lastError: null, accepted: 0 });
    else pollStates.get(account.id)!.configured = Boolean(account.sourceUrl);
    const configured = Boolean(account.playerTag && (account.clashApiToken || process.env.CLASH_OF_CLANS_API_TOKEN));
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

async function ingest(account: Account, raw: SnapshotDocument, { dataSource = "push", onlyNewer = false }: { dataSource?: string; onlyNewer?: boolean } = {}): Promise<VillageSnapshot | null> {
  const dir = path.join(root, "accounts", account.id);
  const previous = await readJson<VillageSnapshot>(path.join(dir, "latest.json"));
  const snapshot = normalizeSnapshot(account, raw, { dataSource });
  if (onlyNewer && previous && new Date(snapshot.lastSeen).getTime() <= new Date(previous.lastSeen).getTime()) return null;
  await appendSnapshotRecord(root, account.id, snapshot, raw);
  await writeJson(path.join(dir, "latest.json"), snapshot);
  for (const event of completionEvents(previous, snapshot)) await appendEventRecord(root, event);
  return snapshot;
}

async function poll(account: Account): Promise<void> {
  if (!account.sourceUrl) return;
  const state = pollStates.get(account.id)!;
  state.lastAttemptAt = new Date().toISOString();
  try {
    const response = await fetch(account.sourceUrl, { headers: { Authorization: `Bearer ${account.apiKey}`, Accept: "application/json, application/x-ndjson" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text(); let accepted = 0;
    for (const document of parseSnapshotDocuments(text, response.headers.get("content-type") || "application/json")) {
      if (await ingest(account, document, { dataSource: "pull", onlyNewer: true })) accepted += 1;
    }
    Object.assign(state, { lastSuccessAt: new Date().toISOString(), lastError: null, accepted });
  } catch (error) { state.lastError = (error as Error).message; console.error(`[collector] ${account.id}: ${(error as Error).message}`); }
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

async function dashboard(): Promise<{ generatedAt: string; accounts: VillageSnapshot[] }> {
  const manual = await listManualUpgrades({ activeOnly: true });
  const exports = new Map((await listLatestVillageExports()).map((item) => [item.accountId, item]));
  const result = await Promise.all(accounts.map(async (account) => {
    const stored = await readJson<VillageSnapshot>(path.join(root, "accounts", account.id, "latest.json"));
    const villageExport = exports.get(account.id)?.normalized;
    const accountManual = manual.filter((upgrade) => upgrade.accountId === account.id).map((upgrade) => ({ ...upgrade, id: `manual:${upgrade.id}` }));
    const latest: VillageSnapshot = stored || {
      id: account.id, name: account.label, tag: account.playerTag, townHall: 0, level: 0, color: account.color,
      dataSource: "manual", online: false, lastSeen: new Date().toISOString(), builders: { free: 0, total: 0 },
      resources: null, upgrades: [],
    };
    if (villageExport && (!stored || new Date(villageExport.exportedAt) >= new Date(stored.lastSeen))) {
      Object.assign(latest, {
        tag: villageExport.tag, townHall: villageExport.townHall || latest.townHall,
        builders: villageExport.builders, upgradeSlots: villageExport.upgradeSlots, upgrades: villageExport.upgrades,
        lastSeen: villageExport.exportedAt, dataSource: "game-export", online: true,
      });
    }
    const manualKeys = new Set(accountManual.map((upgrade) => `${upgrade.type}:${upgrade.name.toLowerCase()}`));
    const upgrades = [...latest.upgrades.filter((upgrade) => !manualKeys.has(`${upgrade.type}:${upgrade.name.toLowerCase()}`)), ...accountManual]
      .filter((upgrade) => isUpgradeActive(upgrade));
    return mergeOfficialProfile({ ...latest, id: account.id, color: account.color, upgrades, online: Boolean(stored || villageExport) && Date.now() - new Date(latest.lastSeen).getTime() < interval * 2.5 }, officialProfiles.get(account.id));
  }));
  return { generatedAt: new Date().toISOString(), accounts: result };
}

function accountInput(value: RequestValue, existing: Account | null): Omit<Account, "id" | "legacyIndex"> {
  const label = String(value.label || "").trim();
  if (!label) throw new Error("label is required");
  const playerTag = normalizePlayerTag(value.playerTag || existing?.playerTag);
  return {
    label, playerTag, apiKey: String(value.apiKey || existing?.apiKey || randomUUID()),
    color: String(value.color || existing?.color || "#4c9a79"),
    sourceUrl: String(value.sourceUrl ?? existing?.sourceUrl ?? ""),
    clashApiToken: String(value.clashApiToken || existing?.clashApiToken || ""),
  };
}

function upgradeInput(value: RequestValue, existing: Partial<ManualUpgrade> = {}): Omit<ManualUpgrade, "id"> {
  const accountId = String(value.accountId ?? existing.accountId ?? "");
  const name = String(value.name ?? existing.name ?? "").trim();
  const type = String(value.type ?? existing.type ?? "building") as UpgradeType;
  if (!accounts.some((account) => account.id === accountId)) throw new Error("unknown account");
  if (!name) throw new Error("upgrade name is required");
  if (!["building", "hero", "pet", "research"].includes(type)) throw new Error("invalid upgrade type");
  const startedAt = String(value.startedAt || existing.startedAt || new Date().toISOString());
  const finishAt = value.remainingMinutes != null ? new Date(Date.now() + Number(value.remainingMinutes) * 60_000).toISOString() : String(value.finishAt || existing.finishAt || "");
  if (!finishAt || Number.isNaN(new Date(finishAt).getTime())) throw new Error("finishAt or remainingMinutes is required");
  return { accountId, name, type, level: Number(value.level ?? existing.level ?? 0), nextLevel: Number(value.nextLevel ?? existing.nextLevel ?? Number(value.level ?? 0) + 1), startedAt, finishAt, status: String(value.status ?? existing.status ?? "active") };
}

async function emitManualCompletion(upgrade: ManualUpgrade): Promise<void> {
  const account = accounts.find((item) => item.id === upgrade.accountId);
  if (!account) return;
  await appendEventRecord(root, {
    id: `${account.id}:manual:${upgrade.id}:${upgrade.finishAt}`, type: "upgrade.completed", accountId: account.id,
    accountName: account.label, occurredAt: new Date().toISOString(), title: `${account.label} 업그레이드 완료`,
    body: `${upgrade.name} 레벨 ${upgrade.nextLevel} 완료 예정 시각 도달`, data: { upgrade },
  });
}

function previewVillageExport(value: RequestValue) {
  const parsed = parseVillageExport(value.export ?? value.exportText ?? value);
  const account = accounts.find((item) => item.playerTag === parsed.tag);
  return {
    parsed,
    preview: {
      tag: parsed.tag, exportedAt: parsed.exportedAt, townHall: parsed.townHall, builders: parsed.builders,
      upgrades: parsed.upgrades.map(({ id, name, type, level, nextLevel, finishAt }) => ({ id, name, type, level, nextLevel, finishAt })),
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
  const previous = await saveVillageExport(account.id, parsed);
  if (previous) {
    const currentKeys = new Set(parsed.upgrades.map((upgrade) => `${upgrade.base}:${upgrade.type}:${upgrade.dataId}:${upgrade.level}`));
    for (const upgrade of previous.normalized.upgrades || []) {
      if (!currentKeys.has(`${upgrade.base}:${upgrade.type}:${upgrade.dataId}:${upgrade.level}`)) {
        await appendEventRecord(root, {
          id: `${account.id}:export:${upgrade.id}:${parsed.exportedAt}`, type: "upgrade.completed", accountId: account.id,
          accountName: account.label, occurredAt: parsed.exportedAt, title: `${account.label} 업그레이드 변경 감지`,
          body: `${upgrade.name} 레벨 ${upgrade.nextLevel} 진행 목록에서 사라짐`, data: { upgrade },
        });
      }
    }
  }
  return { account: { id: account.id, label: account.label }, created, exportedAt: parsed.exportedAt, upgrades: parsed.upgrades.length, builders: parsed.builders, unknownDataIds: parsed.unknownDataIds };
}

async function completeDue(): Promise<void> {
  for (const upgrade of await completeDueManualUpgrades()) await emitManualCompletion(upgrade);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "OPTIONS") { response.writeHead(204, cors); return response.end(); }
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true, accounts: accounts.length, database: true, adminConfigured: Boolean(adminToken), retention: { snapshots: snapshotRetentionDays, events: eventRetentionDays } });
    if (request.method === "GET" && url.pathname === "/api/dashboard") return json(response, 200, await dashboard());
    if (request.method === "GET" && url.pathname === "/api/sources") return json(response, 200, { accounts: accounts.map((account) => ({ id: account.id, label: account.label, source: pollStates.get(account.id), official: officialStates.get(account.id) })) });
    if (request.method === "GET" && url.pathname === "/api/history") {
      const account = accounts.find((item) => item.id === url.searchParams.get("account"));
      if (!account) return json(response, 404, { error: "unknown account" });
      const limit = Math.max(1, Math.min(500, Math.floor(Number(url.searchParams.get("limit") || 100)) || 100));
      const records = await readSnapshotHistory(root, account.id, limit);
      return json(response, 200, { account: { id: account.id, name: account.label }, snapshots: records.map((record) => record.snapshot || normalizeSnapshot(account, record.source || {})) });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(request, response)) return;
      if (request.method === "GET" && url.pathname === "/api/admin/accounts") return json(response, 200, { accounts: accounts.map(({ apiKey, clashApiToken, legacyIndex, ...account }) => ({ ...account, hasApiKey: Boolean(apiKey), hasClashApiToken: Boolean(clashApiToken) })) });
      if (request.method === "POST" && url.pathname === "/api/admin/accounts") {
        const account = await createAccount(accountInput(await requestJson(request), null)); await refreshAccounts();
        await Promise.all([poll(account), refreshOfficialProfile(account)]);
        return json(response, 201, { account: { id: account.id, label: account.label, playerTag: account.playerTag, color: account.color } });
      }
      const accountPath = url.pathname.match(/^\/api\/admin\/accounts\/([0-9a-f-]{36})$/i);
      if (request.method === "PATCH" && accountPath) {
        const existing = accounts.find((item) => item.id === accountPath[1]);
        if (!existing) return json(response, 404, { error: "unknown account" });
        const account = await updateAccount(existing.id, accountInput(await requestJson(request), existing));
        if (!account) return json(response, 404, { error: "unknown account" });
        await refreshAccounts();
        return json(response, 200, { account: { id: account.id, label: account.label, playerTag: account.playerTag, color: account.color } });
      }
      if (request.method === "DELETE" && accountPath) { await deleteAccount(accountPath[1]); await refreshAccounts(); return json(response, 200, { deleted: true }); }
      if (request.method === "GET" && url.pathname === "/api/admin/upgrades") return json(response, 200, { upgrades: await listManualUpgrades() });
      if (request.method === "POST" && url.pathname === "/api/admin/upgrades") return json(response, 201, { upgrade: await createManualUpgrade(upgradeInput(await requestJson(request))) });
      if (request.method === "POST" && url.pathname === "/api/admin/village-export/preview") {
        const { preview } = previewVillageExport(await requestJson(request));
        return json(response, 200, preview);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/village-export") return json(response, 201, await importVillageExport(await requestJson(request)));
      const upgradePatch = request.method === "PATCH" && url.pathname.match(/^\/api\/admin\/upgrades\/(\d+)$/);
      if (upgradePatch) {
        const current = (await listManualUpgrades()).find((item) => item.id === upgradePatch[1]);
        if (!current) return json(response, 404, { error: "unknown upgrade" });
        const value = await requestJson(request);
        const upgrade = Object.keys(value).length === 1 && value.status ? await setManualUpgradeStatus(upgradePatch[1], String(value.status)) : await updateManualUpgrade(upgradePatch[1], upgradeInput(value, current));
        if (upgrade?.status === "completed" && current.status !== "completed") await emitManualCompletion(upgrade);
        return json(response, 200, { upgrade });
      }
    }

    if (request.method === "POST" && url.pathname === "/api/ingest") {
      const documents = parseSnapshotDocuments(await body(request), request.headers["content-type"]);
      const secret = String(bearer(request));
      let account = accounts.find((item) => equalSecret(secret, item.apiKey));
      if (!account && equalSecret(secret, adminToken)) {
        const tags = new Set(documents.map((document) => normalizePlayerTag(document.village?.tag || document.tag)));
        if (tags.size !== 1) throw new Error("admin ingest requires one consistent player tag");
        account = accounts.find((item) => item.playerTag === [...tags][0]);
      }
      if (!account) return json(response, 401, { error: "invalid api key or unknown player tag" });
      const rate = consumeIngest(`${account.id}:${request.socket.remoteAddress || "unknown"}`);
      if (!rate.allowed) return json(response, 429, { error: "ingest rate limit exceeded" }, { "Retry-After": String(rate.retryAfterSeconds) });
      const snapshots: Array<VillageSnapshot | null> = [];
      const dataSource = request.headers["x-data-origin"] === "example" ? "example" : "push";
      for (const document of documents) snapshots.push(await ingest(account, document, { dataSource }));
      return json(response, 202, { accepted: snapshots.length, latest: snapshots.at(-1) });
    }
    json(response, 404, { error: "not found" });
  } catch (error) { const message = (error as Error).message; json(response, message === "payload too large" ? 413 : 400, { error: message }); }
});

function json(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(value));
}

await Promise.all(accounts.flatMap((account) => [refreshOfficialProfile(account), poll(account)]));
setInterval(() => accounts.forEach((account) => { refreshOfficialProfile(account); poll(account); }), interval).unref();
await completeDue();
setInterval(completeDue, Math.min(interval, 60_000)).unref();
const clean = () => cleanupRetention(root, accounts.map((account) => account.id), { snapshotDays: snapshotRetentionDays, eventDays: eventRetentionDays }).catch((error: Error) => console.error(`[collector] retention: ${error.message}`));
await clean(); setInterval(clean, 6 * 60 * 60 * 1000).unref();
server.listen(port, "0.0.0.0", () => console.log(`[collector] listening on :${port}`));
