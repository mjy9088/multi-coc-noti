import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legacyIndex: integer("legacy_index"),
    label: text("label").notNull(),
    playerTag: text("player_tag").notNull().default(""),
    color: text("color").notNull().default("#4c9a79"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    resourceStatus: text("resource_status").notNull().default("unanswered"),
    resourceStatusUpdatedAt: timestamp("resource_status_updated_at", { withTimezone: true }).notNull().defaultNow(),
    resourcePreparationMinutes: integer("resource_preparation_minutes").default(60),
    ...timestamps,
  },
  (table) => [
    check(
      "accounts_resource_status_check",
      sql`${table.resourceStatus} IN ('abundant', 'sufficient', 'insufficient', 'unanswered')`,
    ),
    check(
      "accounts_resource_preparation_minutes_check",
      sql`${table.resourcePreparationMinutes} IS NULL OR ${table.resourcePreparationMinutes} BETWEEN 1 AND 525600`,
    ),
    uniqueIndex("accounts_legacy_index_unique_idx").on(table.legacyIndex).where(sql`${table.legacyIndex} IS NOT NULL`),
    uniqueIndex("accounts_unique_player_tag_idx")
      .on(sql`upper(${table.playerTag})`)
      .where(sql`${table.playerTag} <> ''`),
  ],
);

export const dashboardSettings = pgTable(
  "dashboard_settings",
  {
    singleton: boolean("singleton").primaryKey().default(true),
    groupOrder: text("group_order").array().notNull().default(sql`ARRAY[]::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("dashboard_settings_singleton_check", sql`${table.singleton}`)],
);

export const trackedUpgrades = pgTable(
  "tracked_upgrades",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    base: text("base").notNull().default("home"),
    currentLevel: integer("current_level").notNull().default(0),
    nextLevel: integer("next_level").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishAt: timestamp("finish_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("active"),
    notificationOffsets: integer("notification_offsets").array().notNull().default(sql`ARRAY[60, 1, 0]`),
    resourcePreparationOverrideMinutes: integer("resource_preparation_override_minutes"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    check("tracked_upgrades_source_check", sql`${table.source} = 'export'`),
    check("tracked_upgrades_type_check", sql`${table.type} IN ('building', 'hero', 'pet', 'research')`),
    check("tracked_upgrades_base_check", sql`${table.base} IN ('home', 'builder')`),
    check("tracked_upgrades_status_check", sql`${table.status} IN ('active', 'completed', 'cancelled')`),
    check(
      "tracked_upgrades_resource_preparation_override_check",
      sql`${table.resourcePreparationOverrideMinutes} IS NULL OR ${table.resourcePreparationOverrideMinutes} BETWEEN 0 AND 525600`,
    ),
    uniqueIndex("tracked_upgrades_source_key_idx").on(table.accountId, table.source, table.sourceKey),
    index("tracked_upgrades_account_status_idx").on(table.accountId, table.status, table.finishAt),
  ],
);

export const upgradeNotifications = pgTable(
  "upgrade_notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    upgradeId: bigint("upgrade_id", { mode: "number" })
      .notNull()
      .references(() => trackedUpgrades.id, { onDelete: "cascade" }),
    minutesBefore: integer("minutes_before").notNull(),
    notificationKind: text("notification_kind").notNull(),
    preparationMinutes: integer("preparation_minutes"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    check("upgrade_notifications_minutes_before_check", sql`${table.minutesBefore} >= 0`),
    check(
      "upgrade_notifications_notification_kind_check",
      sql`${table.notificationKind} IN ('completion', 'one_minute', 'resource_preparation', 'refresh_required', 'legacy')`,
    ),
    check("upgrade_notifications_status_check", sql`${table.status} IN ('pending', 'processing', 'sent', 'skipped')`),
    uniqueIndex("upgrade_notifications_policy_kind_idx")
      .on(table.upgradeId, table.notificationKind)
      .where(sql`${table.notificationKind} <> 'legacy'`),
    index("upgrade_notifications_due_idx").on(table.status, table.nextAttemptAt, table.scheduledAt),
  ],
);

export const villageExports = pgTable(
  "village_exports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    playerTag: text("player_tag").notNull(),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull(),
    raw: jsonb("raw").notNull(),
    normalized: jsonb("normalized").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("village_exports_account_exported_unique_idx").on(table.accountId, table.exportedAt),
    index("village_exports_latest_idx").on(table.accountId, table.exportedAt.desc()),
  ],
);

export const appMigrations = pgTable("app_migrations", {
  key: text("key").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resourceReminderSuppressions = pgTable(
  "resource_reminder_suppressions",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    notificationId: bigint("notification_id", { mode: "number" })
      .notNull()
      .references(() => upgradeNotifications.id, { onDelete: "cascade" }),
    suppressUntil: timestamp("suppress_until", { withTimezone: true }).notNull(),
    preparationMinutes: integer("preparation_minutes").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId] })],
);

export const schema = {
  accounts,
  dashboardSettings,
  trackedUpgrades,
  upgradeNotifications,
  villageExports,
  appMigrations,
  resourceReminderSuppressions,
};
