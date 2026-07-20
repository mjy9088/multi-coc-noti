export { closeDatabase, database, drizzleDatabase } from "./client.ts";
export { migrate } from "./migrate.ts";
export { createAccount, deleteAccount, listAccounts } from "./repositories/account-repository.ts";
export type { AuthenticatedUser } from "./repositories/auth-repository.ts";
export {
  authenticateSessionToken,
  claimUnownedLegacyData,
  createLocalTestSession,
  ensureLocalTestUser,
  localTestUserId,
} from "./repositories/auth-repository.ts";
export {
  getDashboardSettings,
  updateDashboardSettings,
} from "./repositories/dashboard-settings-repository.ts";
export type { BarkChannelInput } from "./repositories/notification-channel-repository.ts";
export {
  deleteNotificationChannel,
  listNotificationChannels,
  saveBarkChannel,
} from "./repositories/notification-channel-repository.ts";
export { listTrackedUpgrades, listUpgradeHistory } from "./repositories/upgrade-repository.ts";
export {
  latestVillageExport,
  listLatestVillageExports,
  listSyncHistory,
} from "./repositories/village-export-repository.ts";
export { authAccounts, authSessions, authVerificationTokens, users } from "./schema.ts";
export type {
  DueChannelDelivery,
  DueNotification,
  NotificationKind,
  SyncHistoryEntry,
  TrackedUpgrade,
  UpgradeSource,
  VillageHistoryBundle,
  VillageHistoryImportResult,
} from "./types.ts";
export {
  claimDueChannelDeliveries,
  claimDueNotifications,
  completeDueTrackedUpgrades,
  exportVillageHistories,
  importVillageHistory,
  markChannelDeliveryFailed,
  markChannelDeliverySent,
  markNotificationFailed,
  markNotificationSent,
  saveVillageExport,
  syncTrackedUpgrades,
  updateAccount,
  updateAccountResourceStatus,
  updateUpgradePreparationOverride,
} from "./use-cases/index.ts";
