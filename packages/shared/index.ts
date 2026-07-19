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
  userId: string | null;
  legacyIndex?: number | null;
  label: string;
  playerTag: string;
  color: string;
  tags: string[];
  resourceStatus: ResourceStatus;
  resourceStatusUpdatedAt: string;
  resourcePreparationMinutes: number | null;
};

export type VillageCooldowns = {
  clockTower: string | null;
  helpers: Array<{ dataId: number; availableAt: string }>;
};

export type VillageHelper = { dataId: number; name: string; level: number; availableAt: string | null };
export type HeroEquipment = { dataId: number; name: string; level: number };
export type OfficialPlayerStats = {
  trophies: number;
  bestTrophies: number;
  league: string | null;
  warStars: number;
  donations: number;
  donationsReceived: number;
  capitalContributions: number;
};

export type VillageSnapshot = {
  id: string;
  name: string;
  tag: string;
  townHall: number;
  level: number;
  color: string;
  tags?: string[];
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
  cooldowns?: VillageCooldowns;
  helpers?: VillageHelper[];
  heroEquipment?: HeroEquipment[];
  officialStats?: OfficialPlayerStats;
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

export function isUpgradeActive(upgrade: Pick<Upgrade, "finishAt">, reference = Date.now()): boolean {
  const finish = new Date(upgrade.finishAt).getTime();
  return Number.isFinite(finish) && finish > reference;
}

export function isVillageRefreshRequired(
  lastSeen: string,
  finishAt: string,
  now = Date.now(),
  graceMs = 30 * 60_000,
): boolean {
  const observed = new Date(lastSeen).getTime();
  const finished = new Date(finishAt).getTime();
  return Number.isFinite(observed) && Number.isFinite(finished) && finished > observed && finished + graceMs <= now;
}
