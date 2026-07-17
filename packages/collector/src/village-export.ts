import type { HeroEquipment, Upgrade, UpgradeType, VillageCooldowns, VillageHelper } from "@multi-coc/shared";
import { builder, home } from "clash-of-clans-data";

const PLAYER_TAG = /^#[0289PYLQGRJCUV]{3,15}$/;
const MAX_TIMER_SECONDS = 180 * 24 * 60 * 60;
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const groups = [
  home().defenses(),
  home().craftedDefenses(),
  home().traps(),
  home().walls(),
  home().troops(),
  home().spells(),
  home().siegeMachines(),
  home().heroes(),
  home().heroEquipment(),
  home().pets(),
  home().resourceBuildings(),
  home().armyBuildings(),
  home().guardians(),
  home().townHall(),
  builder().defenses(),
  builder().traps(),
  builder().walls(),
  builder().troops(),
  builder().heroes(),
  builder().resourceBuildings(),
  builder().armyBuildings(),
  builder().builderHall(),
  builder().otherBuildings(),
  home().otherBuildings().helpers(),
];
type DataItem = { dataId: number; name: string };
const names = new Map<number, string>(
  groups.flatMap((group) => group.get() as unknown as DataItem[]).map((item) => [Number(item.dataId), item.name]),
);

const sections: Array<readonly [string, UpgradeType, "home" | "builder"]> = [
  ["buildings", "building", "home"],
  ["traps", "building", "home"],
  ["heroes", "hero", "home"],
  ["units", "research", "home"],
  ["spells", "research", "home"],
  ["siege_machines", "research", "home"],
  ["pets", "pet", "home"],
  ["buildings2", "building", "builder"],
  ["traps2", "building", "builder"],
  ["units2", "research", "builder"],
  ["heroes2", "hero", "builder"],
];

type ExportEntry = { data?: number; lvl?: number; timer?: number; cnt?: number };
type RawVillageExport = { tag?: string; timestamp?: number; [section: string]: unknown };
export type ExportUpgrade = Upgrade & {
  dataId: number;
  base: "home" | "builder";
  remainingSeconds: number;
  startedAt: null;
};
export type ParsedVillageExport = {
  tag: string;
  exportedAt: string;
  timestamp: number;
  townHall: number;
  builders: { total: number; free: number; regularTotal: number };
  upgrades: ExportUpgrade[];
  upgradeSlots: {
    laboratory: { available: boolean; active: number; total: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: {
      builders: { total: number; free: number };
      laboratory: { available: boolean; active: number; total: number } | null;
    } | null;
  };
  cooldowns: VillageCooldowns;
  helpers: VillageHelper[];
  heroEquipment: HeroEquipment[];
  unknownDataIds: number[];
  raw: RawVillageExport;
};
export type VillageExportDiff = {
  hasPrevious: boolean;
  started: Array<Pick<ExportUpgrade, "id" | "name" | "type" | "base" | "level" | "nextLevel">>;
  ended: Array<Pick<ExportUpgrade, "id" | "name" | "type" | "base" | "level" | "nextLevel">>;
  slots: Array<{
    slot: "homeBuilders" | "homeLaboratory" | "petHouse" | "builderBuilders" | "builderLaboratory";
    before: number | boolean | null;
    after: number | boolean | null;
  }>;
};

type ComparableExport = {
  upgrades: Array<Pick<Upgrade, "id" | "name" | "type" | "base" | "level" | "nextLevel">>;
  builders: { free: number };
  upgradeSlots?: {
    laboratory?: { available: boolean } | null;
    petHouse?: { available: boolean } | null;
    builderBase?: { builders: { free: number }; laboratory?: { available: boolean } | null } | null;
  };
};

export function compareVillageExports(previous: ComparableExport | null, current: ComparableExport): VillageExportDiff {
  if (!previous) return { hasPrevious: false, started: [], ended: [], slots: [] };
  const compact = ({ id, name, type, base, level, nextLevel }: ComparableExport["upgrades"][number]) => ({
    id,
    name,
    type,
    base: base === "builder" ? ("builder" as const) : ("home" as const),
    level,
    nextLevel,
  });
  const previousKeys = new Set(previous.upgrades.map((item) => item.id));
  const currentKeys = new Set(current.upgrades.map((item) => item.id));
  const values = {
    homeBuilders: [previous.builders.free, current.builders.free],
    homeLaboratory: [
      previous.upgradeSlots?.laboratory?.available ?? null,
      current.upgradeSlots?.laboratory?.available ?? null,
    ],
    petHouse: [previous.upgradeSlots?.petHouse?.available ?? null, current.upgradeSlots?.petHouse?.available ?? null],
    builderBuilders: [
      previous.upgradeSlots?.builderBase?.builders.free ?? null,
      current.upgradeSlots?.builderBase?.builders.free ?? null,
    ],
    builderLaboratory: [
      previous.upgradeSlots?.builderBase?.laboratory?.available ?? null,
      current.upgradeSlots?.builderBase?.laboratory?.available ?? null,
    ],
  } as const;
  return {
    hasPrevious: true,
    started: current.upgrades.filter((item) => !previousKeys.has(item.id)).map(compact),
    ended: previous.upgrades.filter((item) => !currentKeys.has(item.id)).map(compact),
    slots: Object.entries(values).flatMap(([slot, [before, after]]) =>
      before === after ? [] : [{ slot: slot as VillageExportDiff["slots"][number]["slot"], before, after }],
    ),
  };
}

export function parseVillageCooldowns(input: unknown, fallbackTimestamp?: number): VillageCooldowns {
  if (!input || Array.isArray(input) || typeof input !== "object") return { clockTower: null, helpers: [] };
  const document = input as RawVillageExport;
  const timestamp = Number(document.timestamp || fallbackTimestamp);
  if (!Number.isInteger(timestamp) || timestamp <= 0) return { clockTower: null, helpers: [] };
  const availableAt = (value: unknown) => {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_TIMER_SECONDS
      ? new Date((timestamp + seconds) * 1000).toISOString()
      : null;
  };
  const boosts =
    document.boosts && !Array.isArray(document.boosts) && typeof document.boosts === "object"
      ? (document.boosts as Record<string, unknown>)
      : {};
  const clockTower = availableAt(boosts.clocktower_cooldown);
  const helpers = (Array.isArray(document.helpers) ? document.helpers : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const helper = entry as Record<string, unknown>;
    const dataId = Number(helper.data);
    const helperAvailableAt = availableAt(helper.helper_cooldown);
    return Number.isInteger(dataId) && dataId > 0 && helperAvailableAt
      ? [{ dataId, availableAt: helperAvailableAt }]
      : [];
  });
  return { clockTower, helpers };
}

export function parseVillageDetails(
  input: unknown,
  fallbackTimestamp?: number,
): { cooldowns: VillageCooldowns; helpers: VillageHelper[]; heroEquipment: HeroEquipment[] } {
  const cooldowns = parseVillageCooldowns(input, fallbackTimestamp);
  if (!input || Array.isArray(input) || typeof input !== "object") return { cooldowns, helpers: [], heroEquipment: [] };
  const document = input as RawVillageExport;
  const helperCooldowns = new Map(cooldowns.helpers.map((item) => [item.dataId, item.availableAt]));
  const helpers = (Array.isArray(document.helpers) ? document.helpers : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const dataId = Number(item.data);
    const level = Number(item.lvl || 0);
    return Number.isInteger(dataId) && dataId > 0 && Number.isInteger(level) && level >= 0
      ? [
          {
            dataId,
            name: names.get(dataId) || `Helper #${dataId}`,
            level,
            availableAt: helperCooldowns.get(dataId) || null,
          },
        ]
      : [];
  });
  const heroEquipment = (Array.isArray(document.equipment) ? document.equipment : []).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const dataId = Number(item.data);
    const level = Number(item.lvl || 0);
    return Number.isInteger(dataId) && dataId > 0 && Number.isInteger(level) && level >= 0
      ? [{ dataId, name: names.get(dataId) || `Equipment #${dataId}`, level }]
      : [];
  });
  return { cooldowns, helpers, heroEquipment };
}

export function normalizePlayerTag(value: unknown): string {
  const tag = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const normalized = tag.startsWith("#") ? tag : `#${tag}`;
  if (!PLAYER_TAG.test(normalized)) throw new Error("invalid player tag in village export");
  return normalized;
}

export function parseVillageExport(input: unknown, { now = Date.now() } = {}): ParsedVillageExport {
  let raw: unknown;
  try {
    raw = typeof input === "string" ? (JSON.parse(input) as unknown) : input;
  } catch {
    throw new Error("village export is not valid JSON");
  }
  if (!raw || Array.isArray(raw) || typeof raw !== "object") throw new Error("village export must be a JSON object");
  const document = raw as RawVillageExport;
  const tag = normalizePlayerTag(document.tag);
  const timestamp = Number(document.timestamp);
  if (!Number.isInteger(timestamp) || timestamp <= 0) throw new Error("village export timestamp is invalid");
  const nowSeconds = Math.floor(now / 1000);
  if (timestamp > nowSeconds + 10 * 60) throw new Error("village export timestamp is too far in the future");
  if (timestamp < nowSeconds - MAX_AGE_SECONDS) throw new Error("village export is older than 30 days");

  const upgrades: ExportUpgrade[] = [];
  const unknownDataIds = new Set<number>();
  for (const [section, type, base] of sections) {
    const entries = document[section];
    if (entries == null) continue;
    if (!Array.isArray(entries)) throw new Error(`${section} must be an array`);
    const ordinals = new Map<string, number>();
    (entries as ExportEntry[]).forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || entry.timer == null || Number(entry.timer) <= 0) return;
      const timer = Number(entry.timer);
      const dataId = Number(entry.data);
      const level = Number(entry.lvl || 0);
      if (!Number.isFinite(timer) || timer > MAX_TIMER_SECONDS)
        throw new Error(`${section}[${index}] has an invalid timer`);
      if (!Number.isInteger(dataId) || dataId <= 0) throw new Error(`${section}[${index}] has an invalid data id`);
      if (!Number.isInteger(level) || level < 0 || level > 200)
        throw new Error(`${section}[${index}] has an invalid level`);
      const name = names.get(dataId);
      if (!name) unknownDataIds.add(dataId);
      const identity = `${dataId}:${level + 1}`;
      const ordinal = (ordinals.get(identity) || 0) + 1;
      ordinals.set(identity, ordinal);
      upgrades.push({
        id: `${section}:${dataId}:${level + 1}:${ordinal}`,
        dataId,
        name: name || `Unknown #${dataId}`,
        type,
        base,
        level,
        nextLevel: level + 1,
        startedAt: null,
        finishAt: new Date((timestamp + timer) * 1000).toISOString(),
        remainingSeconds: timer,
      });
    });
  }

  const buildings = (Array.isArray(document.buildings) ? document.buildings : []) as ExportEntry[];
  const builderHuts = buildings
    .filter((entry) => Number(entry.data) === 1000015)
    .reduce((sum, entry) => sum + Number(entry.cnt || 1), 0);
  const builderBuildings = (Array.isArray(document.buildings2) ? document.buildings2 : []) as ExportEntry[];
  const bobUnlocked = builderBuildings.some((entry) => Number(entry.data) === 1000065 && Number(entry.lvl) > 0);
  const regularBuilders = builderHuts + (bobUnlocked ? 1 : 0);
  const busyBuilders = upgrades.filter(
    (upgrade) => upgrade.base === "home" && (upgrade.type === "building" || upgrade.type === "hero"),
  ).length;
  const totalBuilders = Math.max(regularBuilders, busyBuilders);
  const laboratory = buildings.find((entry) => Number(entry.data) === 1000007);
  const petHouse = buildings.find((entry) => Number(entry.data) === 1000068);
  const builderLaboratory = builderBuildings.find((entry) => Number(entry.data) === 1000046);
  const ottosOutpost = builderBuildings.find((entry) => Number(entry.data) === 1000078 && Number(entry.lvl) > 0);
  const builderBaseUnlocked = builderBuildings.length > 0;
  const busyBuilderBaseBuilders = upgrades.filter(
    (upgrade) => upgrade.base === "builder" && upgrade.type !== "research",
  ).length;
  const regularBuilderBaseBuilders = builderBaseUnlocked ? (ottosOutpost ? 2 : 1) : 0;
  const totalBuilderBaseBuilders = Math.max(regularBuilderBaseBuilders, busyBuilderBaseBuilders);
  const slotAvailable = (building: ExportEntry | undefined, base: "home" | "builder", type: UpgradeType) =>
    building
      ? {
          available:
            !(Number(building.timer) > 0) &&
            !upgrades.some((upgrade) => upgrade.base === base && upgrade.type === type),
        }
      : null;
  const laboratorySlot = (building: ExportEntry | undefined, base: "home" | "builder") => {
    if (!building) return null;
    const active = upgrades.filter((upgrade) => upgrade.base === base && upgrade.type === "research").length;
    return { available: !(Number(building.timer) > 0) && active === 0, active, total: Math.max(1, active) };
  };
  const townHall = buildings.find((entry) => Number(entry.data) === 1000001);
  const { cooldowns, helpers, heroEquipment } = parseVillageDetails(document, timestamp);

  return {
    tag,
    exportedAt: new Date(timestamp * 1000).toISOString(),
    timestamp,
    townHall: Number(townHall?.lvl || 0),
    builders: { total: totalBuilders, free: Math.max(0, totalBuilders - busyBuilders), regularTotal: regularBuilders },
    upgradeSlots: {
      laboratory: laboratorySlot(laboratory, "home"),
      petHouse: slotAvailable(petHouse, "home", "pet"),
      builderBase: builderBaseUnlocked
        ? {
            builders: {
              total: totalBuilderBaseBuilders,
              free: Math.max(0, totalBuilderBaseBuilders - busyBuilderBaseBuilders),
            },
            laboratory: laboratorySlot(builderLaboratory, "builder"),
          }
        : null,
    },
    cooldowns,
    helpers,
    heroEquipment,
    upgrades,
    unknownDataIds: [...unknownDataIds],
    raw: document,
  };
}
