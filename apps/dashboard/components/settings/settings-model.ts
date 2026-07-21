export type ResourceStatus = "abundant" | "sufficient" | "insufficient" | "unanswered";

export type Account = {
  id: string;
  label: string;
  playerTag: string;
  color: string;
  tags: string[];
  resourceStatus: ResourceStatus;
  resourceStatusUpdatedAt: string;
  resourcePreparationMinutes: number | null;
};

export type Upgrade = {
  id: string;
  accountId: string;
  name: string;
  type: string;
  level: number;
  nextLevel: number;
  finishAt: string;
  status: string;
  source: "export";
  notificationOffsets: number[];
  resourcePreparationOverrideMinutes: number | null;
};

export type UpgradeAlertDraft = { mode: "inherit" | "disabled" | "custom"; minutes: number };

export type NotificationChannel = {
  id: string;
  label: string;
  enabled: boolean;
  baseUrl: string;
  deviceKeySuffix: string;
  locale: "ko" | "en";
  defaultGroup: string | null;
};

export type ExportPreview = {
  tag: string;
  townHall: number;
  exportedAt: string;
  isNew: boolean;
  account: { id: string; label: string; color: string } | null;
  upgrades: Array<{ id: string; name: string; type: string; level: number; nextLevel: number; finishAt: string }>;
  builders: { free: number; total: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: {
      builders: { free: number; total: number };
      laboratory: { available: boolean; active?: number; total?: number } | null;
    } | null;
  };
  unknownDataIds: number[];
  changes: {
    hasPrevious: boolean;
    started: Array<{ id: string; name: string; type: string; base: string; level: number; nextLevel: number }>;
    ended: Array<{ id: string; name: string; type: string; base: string; level: number; nextLevel: number }>;
    slots: Array<{
      slot: "homeBuilders" | "homeLaboratory" | "petHouse" | "builderBuilders" | "builderLaboratory";
      before: number | boolean | null;
      after: number | boolean | null;
    }>;
  };
};

export type SettingsSection = "import" | "upgrades" | "channels" | "villages" | "groups";
export type QuickPasteRequest = { id: number; text: string; clipboardError: boolean } | null;

export type BarkChannelForm = { label: string; deviceKey: string; locale: "ko" | "en" };

export type VillageAccountForm = {
  label: string;
  color: string;
  tags: string;
  resourceStatus: ResourceStatus;
  resourcePreparationEnabled: boolean;
  resourcePreparationMinutes: number;
};
