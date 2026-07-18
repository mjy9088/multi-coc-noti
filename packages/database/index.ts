export { closeDatabase, database, drizzleDatabase } from "./client.ts";
export { migrate } from "./migrate.ts";
export { createAccount, deleteAccount, listAccounts } from "./repositories/account-repository.ts";
export {
  getDashboardSettings,
  updateDashboardSettings,
} from "./repositories/dashboard-settings-repository.ts";
export { listTrackedUpgrades, listUpgradeHistory } from "./repositories/upgrade-repository.ts";
export {
  latestVillageExport,
  listLatestVillageExports,
  listSyncHistory,
} from "./repositories/village-export-repository.ts";
export type {
  DueNotification,
  NotificationKind,
  SyncHistoryEntry,
  TrackedUpgrade,
  UpgradeSource,
  VillageHistoryBundle,
  VillageHistoryImportResult,
} from "./types.ts";
export {
  claimDueNotifications,
  completeDueTrackedUpgrades,
  exportVillageHistories,
  importVillageHistory,
  markNotificationFailed,
  markNotificationSent,
  saveVillageExport,
  syncTrackedUpgrades,
  updateAccount,
  updateAccountResourceStatus,
  updateUpgradePreparationOverride,
} from "./use-cases/index.ts";
