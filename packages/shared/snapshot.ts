import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type UpgradeType = "building" | "hero" | "pet" | "research";

export type Upgrade = {
  id: string;
  name: string;
  level: number;
  nextLevel: number;
  type: UpgradeType;
  finishAt: string;
  startedAt?: string | null;
  dataId?: number;
  base?: string;
  remainingSeconds?: number;
  status?: string;
};

export type Account = {
  id: string;
  legacyIndex?: number | null;
  label: string;
  playerTag: string;
  color: string;
  apiKey: string;
  sourceUrl: string;
  clashApiToken: string;
};

export type VillageSnapshot = {
  id: string;
  name: string;
  tag: string;
  townHall: number;
  level: number;
  color: string;
  dataSource: string;
  online: boolean;
  lastSeen: string;
  builders: { free: number; total: number };
  upgradeSlots?: {
    laboratory: { available: boolean } | null;
    petHouse: { available: boolean } | null;
    builderBase: {
      builders: { free: number; total: number };
      laboratory: { available: boolean } | null;
    } | null;
  };
  resources: { gold: number; elixir: number; darkElixir: number; capacity: number } | null;
  upgrades: Upgrade[];
};

export type VillageEvent = {
  id: string;
  type: "upgrade.completed" | "builder.available";
  accountId: string;
  accountName: string;
  occurredAt: string;
  title: string;
  body: string;
  data: { upgrade?: Upgrade; free?: number; total?: number };
};

type RawUpgrade = Partial<Upgrade> & { type?: string };
type RawVillage = {
  name?: string; tag?: string; townHall?: number; level?: number;
  builders?: { total?: number; free?: number };
  upgradeSlots?: VillageSnapshot["upgradeSlots"];
  resources?: { gold?: number; elixir?: number; darkElixir?: number; capacity?: number };
  upgrades?: RawUpgrade[];
};
export type SnapshotDocument = RawVillage & { village?: RawVillage; capturedAt?: string; timestamp?: string | number };

export const dataDir = (): string => process.env.DATA_DIR || "/data";

export async function appendJsonl(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, file);
}

export async function readJson<T>(file: string, fallback: T): Promise<T>;
export async function readJson<T>(file: string): Promise<T | null>;
export async function readJson<T>(file: string, fallback: T | null = null): Promise<T | null> {
  try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return fallback; }
}

export function parseSnapshotDocuments(text: string, contentType = "application/json"): SnapshotDocument[] {
  const value = text.trim();
  if (!value) return [];
  if (!contentType.includes("ndjson")) {
    try {
      const parsed = JSON.parse(value) as SnapshotDocument | SnapshotDocument[];
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Some JSONL endpoints respond with text/plain or application/json.
    }
  }
  return value.split(/\r?\n/).filter(Boolean).map((document) => JSON.parse(document) as SnapshotDocument);
}

const iso = (value?: string | number | null, fallback = new Date().toISOString()): string => {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

export function normalizeSnapshot(account: Pick<Account, "id" | "label" | "color"> & Partial<Pick<Account, "playerTag">>, raw: SnapshotDocument, { dataSource = "unknown" } = {}): VillageSnapshot {
  const village = raw.village || raw;
  const upgrades = Array.isArray(village.upgrades) ? village.upgrades : [];
  const total = Number(village.builders?.total ?? 0);
  const free = Number(village.builders?.free ?? Math.max(0, total - upgrades.filter((upgrade) => upgrade.type !== "research").length));
  return {
    id: account.id,
    name: village.name || account.label || account.id,
    tag: village.tag || account.playerTag || "",
    townHall: Number(village.townHall || 0),
    level: Number(village.level || 0),
    color: account.color || "#4c9a79",
    dataSource,
    online: true,
    lastSeen: iso(raw.capturedAt || raw.timestamp),
    builders: { free: Math.max(0, free), total: Math.max(free, total) },
    ...(village.upgradeSlots ? { upgradeSlots: village.upgradeSlots } : {}),
    resources: village.resources ? {
      gold: Number(village.resources?.gold || 0),
      elixir: Number(village.resources?.elixir || 0),
      darkElixir: Number(village.resources?.darkElixir || 0),
      capacity: Number(village.resources?.capacity || 1),
    } : null,
    upgrades: upgrades.map((upgrade, index) => ({
      id: String(upgrade.id || `${upgrade.type || "building"}:${upgrade.name || index}`),
      name: String(upgrade.name || "알 수 없는 업그레이드"),
      level: Number(upgrade.level || 0),
      nextLevel: Number(upgrade.nextLevel || Number(upgrade.level || 0) + 1),
      type: (["building", "hero", "pet", "research"].includes(upgrade.type || "") ? upgrade.type : "building") as UpgradeType,
      finishAt: iso(upgrade.finishAt),
    })),
  };
}

export function completionEvents(previous: VillageSnapshot | null, current: VillageSnapshot): VillageEvent[] {
  if (!previous) return [];
  const currentIds = new Set(current.upgrades.map((upgrade) => upgrade.id));
  const completed = previous.upgrades.filter((upgrade) => !currentIds.has(upgrade.id));
  const events: VillageEvent[] = completed.map((upgrade) => ({
    id: `${current.id}:upgrade:${upgrade.id}:${upgrade.finishAt}`,
    type: "upgrade.completed",
    accountId: current.id,
    accountName: current.name,
    occurredAt: current.lastSeen,
    title: `${current.name} 업그레이드 완료`,
    body: `${upgrade.name} 레벨 ${upgrade.nextLevel || upgrade.level + 1} 완료`,
    data: { upgrade },
  }));
  if (current.builders.free > previous.builders.free) {
    events.push({
      id: `${current.id}:builder:${current.lastSeen}:${current.builders.free}`,
      type: "builder.available",
      accountId: current.id,
      accountName: current.name,
      occurredAt: current.lastSeen,
      title: `${current.name} 빌더 대기`,
      body: `현재 ${current.builders.free}명의 빌더가 대기 중입니다.`,
      data: { free: current.builders.free, total: current.builders.total },
    });
  }
  return events;
}

export function isUpgradeActive(upgrade: Pick<Upgrade, "finishAt">, reference = Date.now()): boolean {
  const finish = new Date(upgrade.finishAt).getTime();
  return Number.isFinite(finish) && finish > reference;
}
