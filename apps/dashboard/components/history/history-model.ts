export type HistoryVillage = { id: string; name: string; playerTag: string; color: string };

export type HistoryUpgrade = {
  id: string;
  accountId: string;
  name: string;
  type: "building" | "hero" | "pet" | "research";
  base: "home" | "builder";
  level: number;
  nextLevel: number;
  startedAt: string;
  finishAt: string;
  active: boolean;
};

export type SyncEntry = {
  id: string;
  accountId: string;
  playerTag: string;
  exportedAt: string;
  importedAt: string;
  townHall: number;
  upgrades: number;
  homeUpgrades: number;
  builderUpgrades: number;
  builders: { free: number; total: number };
  unknownDataIds: number;
};
