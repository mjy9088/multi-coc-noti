import type {
  Account,
  HeroEquipment,
  ResourceStatus,
  Upgrade,
  VillageCooldowns,
  VillageHelper,
  VillageSnapshot,
} from "@multi-coc/shared";

export type AccountInput = Omit<
  Account,
  "id" | "legacyIndex" | "resourceStatus" | "resourceStatusUpdatedAt" | "resourcePreparationMinutes"
> &
  Partial<Pick<Account, "resourceStatus" | "resourcePreparationMinutes">>;

export type AccountPolicy = {
  resourceStatus: ResourceStatus;
  resourcePreparationMinutes: number | null;
};

export type UpgradeSource = "export";
export type NotificationKind = "completion" | "one_minute" | "resource_preparation" | "refresh_required" | "legacy";
export type TrackedUpgrade = Upgrade & {
  accountId: string;
  startedAt: string;
  status: string;
  source: UpgradeSource;
  sourceKey: string;
  base: "home" | "builder";
  notificationOffsets: number[];
  resourcePreparationOverrideMinutes: number | null;
};
export type DueNotification = {
  id: string;
  upgradeId: string;
  kind: NotificationKind;
  minutesBefore: number;
  preparationMinutes: number | null;
  minutesRemaining: number;
  accountName: string;
  upgradeName: string;
  nextLevel: number;
  finishAt: string;
};
export type ExportData = {
  tag: string;
  exportedAt: string;
  townHall: number;
  builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: VillageSnapshot["upgradeSlots"];
  cooldowns?: VillageCooldowns;
  helpers?: VillageHelper[];
  heroEquipment?: HeroEquipment[];
  upgrades: Upgrade[];
  unknownDataIds: number[];
  raw: unknown;
};
export type VillageHistoryBundle = {
  format: "multi-coc-village-exports";
  version: 2;
  exportedAt: string;
  account: {
    id: string;
    label: string;
    playerTag: string;
    color: string;
    tags?: string[];
    resourceStatus?: ResourceStatus;
    resourceStatusUpdatedAt?: string;
    resourcePreparationMinutes?: number | null;
  };
  villageExports: Array<{ playerTag: string; exportedAt: string; raw: unknown; normalized: ExportData }>;
  upgradeSettings: Array<{
    source: UpgradeSource;
    sourceKey: string;
    notificationOffsets: number[];
    resourcePreparationOverrideMinutes?: number | null;
  }>;
};
export type VillageHistoryImportResult = {
  accountId: string;
  label: string;
  created: boolean;
  villageExports: number;
};
export type SyncHistoryEntry = {
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
