export type Upgrade = {
  id: string;
  name: string;
  level: number;
  nextLevel?: number;
  type: "building" | "hero" | "pet" | "research";
  base?: string;
  finishAt: string;
};

export type Village = {
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
  cooldowns?: { clockTower: string | null; helpers: Array<{ dataId: number; availableAt: string }> };
  helpers?: Array<{ dataId: number; name: string; level: number; availableAt: string | null }>;
  heroEquipment?: Array<{ dataId: number; name: string; level: number }>;
  officialStats?: {
    trophies: number;
    bestTrophies: number;
    league: string | null;
    warStars: number;
    donations: number;
    donationsReceived: number;
    capitalContributions: number;
  };
  upgrades: Upgrade[];
};

export type DashboardData = { generatedAt: string; accounts: Village[]; groupOrder?: string[] };
