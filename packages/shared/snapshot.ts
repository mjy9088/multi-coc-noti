import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type UpgradeType = "building" | "hero" | "pet" | "research";
export type ResourceStatus = "abundant" | "sufficient" | "insufficient" | "unanswered";

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
  tags: string[];
  resourceStatus: ResourceStatus;
  resourceStatusUpdatedAt: string;
  resourcePreparationMinutes: number | null;
};

export type VillageSnapshot = {
  id: string;
  name: string;
  tag: string;
  townHall: number;
  level: number;
  color: string;
  tags?: string[];
  dataSource: string;
  online: boolean;
  refreshRequired?: boolean;
  refreshCompletedAt?: string | null;
  lastSeen: string;
  builders: { free: number; total: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: {
      builders: { free: number; total: number };
      laboratory: { available: boolean; active?: number; total?: number } | null;
    } | null;
  };
  resources: { gold: number; elixir: number; darkElixir: number; capacity: number } | null;
  upgrades: Upgrade[];
};

export function normalizeAccountTags(value: unknown, fallback: string[] = []): string[] {
  if (value == null) return [...fallback];
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const tag = String(item).trim().replace(/^#+/, "").trim().slice(0, 40);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, 20);
}

type RawUpgrade = Partial<Upgrade> & { type?: string };
type RawVillage = {
  name?: string; tag?: string; townHall?: number; level?: number;
  builders?: { total?: number; free?: number; regularTotal?: number };
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

const iso = (value?: string | number | null, fallback = new Date().toISOString()): string => {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

export function normalizeSnapshot(account: Pick<Account, "id" | "label" | "color"> & Partial<Pick<Account, "playerTag" | "tags">>, raw: SnapshotDocument, { dataSource = "unknown" } = {}): VillageSnapshot {
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
    tags: account.tags || [],
    dataSource,
    online: true,
    lastSeen: iso(raw.capturedAt || raw.timestamp),
    builders: { free: Math.max(0, free), total: Math.max(free, total), ...(village.builders?.regularTotal != null ? { regularTotal: Number(village.builders.regularTotal) } : {}) },
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

export function isUpgradeActive(upgrade: Pick<Upgrade, "finishAt">, reference = Date.now()): boolean {
  const finish = new Date(upgrade.finishAt).getTime();
  return Number.isFinite(finish) && finish > reference;
}

export function isVillageRefreshRequired(lastSeen: string, finishAt: string, now = Date.now(), graceMs = 30 * 60_000): boolean {
  const observed = new Date(lastSeen).getTime();
  const finished = new Date(finishAt).getTime();
  return Number.isFinite(observed) && Number.isFinite(finished) && finished > observed && finished + graceMs <= now;
}
