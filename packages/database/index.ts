import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Account, HeroEquipment, ResourceStatus, SnapshotDocument, Upgrade, UpgradeType, VillageCooldowns, VillageHelper, VillageSnapshot } from "@multi-coc/shared";

const { Pool } = pg;
let pool: pg.Pool | undefined;

type AccountInput = Omit<Account, "id" | "legacyIndex" | "resourceStatus" | "resourceStatusUpdatedAt" | "resourcePreparationMinutes"> &
  Partial<Pick<Account, "resourceStatus" | "resourcePreparationMinutes">>;
export type UpgradeSource = "export" | "snapshot";
export type NotificationKind = "completion" | "one_minute" | "resource_preparation" | "refresh_required" | "legacy";
export type TrackedUpgrade = Upgrade & {
  accountId: string; startedAt: string; status: string; source: UpgradeSource;
  sourceKey: string; base: "home" | "builder"; notificationOffsets: number[]; resourcePreparationOverrideMinutes: number | null;
};
export type DueNotification = {
  id: string; upgradeId: string; kind: NotificationKind; minutesBefore: number; preparationMinutes: number | null;
  minutesRemaining: number; accountName: string; upgradeName: string; nextLevel: number; finishAt: string;
};
type ExportData = {
  tag: string; exportedAt: string; townHall: number; builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: VillageSnapshot["upgradeSlots"];
  cooldowns?: VillageCooldowns;
  helpers?: VillageHelper[];
  heroEquipment?: HeroEquipment[];
  upgrades: Upgrade[]; unknownDataIds: number[]; raw: unknown;
};
export type VillageHistoryBundle = {
  format: "multi-coc-village-history";
  version: 1;
  exportedAt: string;
  account: { id: string; label: string; playerTag: string; color: string; tags?: string[]; resourceStatus?: ResourceStatus; resourceStatusUpdatedAt?: string; resourcePreparationMinutes?: number | null };
  snapshots: Array<{ capturedAt: string; dataSource: string; snapshot: VillageSnapshot; source: SnapshotDocument }>;
  villageExports: Array<{ playerTag: string; exportedAt: string; raw: unknown; normalized: ExportData }>;
  upgradeSettings: Array<{ source: UpgradeSource; sourceKey: string; notificationOffsets: number[]; resourcePreparationOverrideMinutes?: number | null }>;
};

export type VillageHistoryImportResult = {
  accountId: string; label: string; created: boolean; snapshots: number; villageExports: number;
};

export function database() {
  if (!pool) pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.PGHOST || "127.0.0.1",
        port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
        database: process.env.PGDATABASE || "multi_coc",
        user: process.env.PGUSER || "coc",
        password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "coc",
      });
  return pool;
}

export async function migrate() {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await database().query(schema);
}

const accountFromRow = (row: pg.QueryResultRow): Account => ({
  id: String(row.id), legacyIndex: row.legacy_index, label: row.label, playerTag: row.player_tag,
  color: row.color, tags: (row.tags as string[] || []).map(String), resourceStatus: row.resource_status as ResourceStatus,
  resourceStatusUpdatedAt: new Date(row.resource_status_updated_at).toISOString(),
  resourcePreparationMinutes: row.resource_preparation_minutes == null ? null : Number(row.resource_preparation_minutes),
});

export async function listAccounts() {
  const { rows } = await database().query("SELECT * FROM accounts ORDER BY lower(label), created_at");
  return rows.map(accountFromRow);
}

export async function createAccount(value: AccountInput): Promise<Account> {
  const { rows } = await database().query(`
    INSERT INTO accounts (label, player_tag, color, tags, resource_status, resource_preparation_minutes)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [value.label, value.playerTag || "", value.color || "#4c9a79", value.tags || [],
    value.resourceStatus || "unanswered", value.resourcePreparationMinutes === undefined ? 60 : value.resourcePreparationMinutes]);
  return accountFromRow(rows[0]);
}

export async function updateAccount(id: string, value: AccountInput): Promise<Account | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const previous = (await client.query("SELECT resource_status,resource_preparation_minutes FROM accounts WHERE id=$1 FOR UPDATE", [id])).rows[0];
    const { rows } = await client.query(`
      UPDATE accounts SET label=$2, player_tag=$3, color=$4, tags=$5,
        resource_status=COALESCE($6,resource_status),
        resource_status_updated_at=CASE WHEN $6::text IS NULL OR $6=resource_status THEN resource_status_updated_at ELSE now() END,
        resource_preparation_minutes=CASE WHEN $8 THEN $7 ELSE resource_preparation_minutes END, updated_at=now()
      WHERE id=$1 RETURNING *
    `, [id, value.label, value.playerTag || "", value.color || "#4c9a79", value.tags || [],
      value.resourceStatus ?? null, value.resourcePreparationMinutes ?? null, value.resourcePreparationMinutes !== undefined]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    const policyChanged = previous && (previous.resource_status !== rows[0].resource_status
      || previous.resource_preparation_minutes !== rows[0].resource_preparation_minutes);
    if (policyChanged) await rescheduleAccountNotifications(client, id);
    await client.query("COMMIT");
    return accountFromRow(rows[0]);
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function updateAccountResourceStatus(id: string, resourceStatus: ResourceStatus): Promise<Account | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`UPDATE accounts
      SET resource_status=$2,resource_status_updated_at=now(),updated_at=now()
      WHERE id=$1 RETURNING *`, [id, resourceStatus]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    await rescheduleAccountNotifications(client, id);
    await client.query("COMMIT");
    return accountFromRow(rows[0]);
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function deleteAccount(id: string): Promise<boolean> {
  const result = await database().query("DELETE FROM accounts WHERE id=$1", [id]);
  return (result.rowCount || 0) > 0;
}

export async function getDashboardSettings(): Promise<{ groupOrder: string[] }> {
  const { rows } = await database().query("SELECT group_order FROM dashboard_settings WHERE singleton=true");
  return { groupOrder: (rows[0]?.group_order as string[] || []).map(String) };
}

export async function updateDashboardSettings(groupOrder: string[]): Promise<{ groupOrder: string[] }> {
  const { rows } = await database().query(`
    INSERT INTO dashboard_settings (singleton,group_order) VALUES (true,$1)
    ON CONFLICT (singleton) DO UPDATE SET group_order=EXCLUDED.group_order,updated_at=now()
    RETURNING group_order
  `, [groupOrder]);
  return { groupOrder: (rows[0].group_order as string[] || []).map(String) };
}

export async function clearLegacyIndex(id: string): Promise<void> {
  await database().query("UPDATE accounts SET legacy_index=NULL WHERE id=$1", [id]);
}

const upgradeFromRow = (row: pg.QueryResultRow): TrackedUpgrade => ({
  id: String(row.id), accountId: String(row.account_id), name: String(row.name), type: row.type as UpgradeType,
  base: row.base === "builder" ? "builder" : "home",
  level: row.current_level, nextLevel: row.next_level,
  startedAt: new Date(row.started_at).toISOString(), finishAt: new Date(row.finish_at).toISOString(), status: row.status,
  source: row.source as UpgradeSource, sourceKey: String(row.source_key),
  notificationOffsets: (row.notification_offsets as number[] || []).map(Number),
  resourcePreparationOverrideMinutes: row.resource_preparation_override_minutes == null ? null : Number(row.resource_preparation_override_minutes),
});

export async function listTrackedUpgrades({ activeOnly = false } = {}): Promise<TrackedUpgrade[]> {
  const where = activeOnly ? "WHERE status='active'" : "";
  const { rows } = await database().query(`SELECT * FROM tracked_upgrades ${where} ORDER BY finish_at`);
  return rows.map(upgradeFromRow);
}

function normalizeOffsets(offsets: number[] | undefined): number[] {
  return [...new Set((offsets || [60, 1, 0]).map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 525_600))].sort((a, b) => b - a);
}

export type PlannedNotification = { kind: Exclude<NotificationKind, "legacy" | "refresh_required">; minutesBefore: number; preparationMinutes: number | null; scheduledAt: Date };

export function resolvePreparationMinutes(villageMinutes: number | null, overrideMinutes: number | null): number | null {
  return overrideMinutes === null ? villageMinutes : overrideMinutes === 0 ? null : overrideMinutes;
}

export function planResourceNotifications(status: ResourceStatus, preparationMinutes: number | null, finishAt: string | Date, now = new Date()): PlannedNotification[] {
  const finish = new Date(finishAt);
  if (status === "abundant") return [{ kind: "completion", minutesBefore: 0, preparationMinutes: null, scheduledAt: finish }];
  if (status === "sufficient") {
    const scheduledAt = new Date(finish.getTime() - 60_000);
    return scheduledAt > now ? [{ kind: "one_minute", minutesBefore: 1, preparationMinutes: null, scheduledAt }] : [];
  }
  const result: PlannedNotification[] = [{ kind: "completion", minutesBefore: 0, preparationMinutes: null, scheduledAt: finish }];
  const preparationAt = preparationMinutes == null ? null : new Date(finish.getTime() - preparationMinutes * 60_000);
  if (preparationMinutes != null && preparationAt && preparationAt > now) result.unshift({
    kind: "resource_preparation", minutesBefore: preparationMinutes, preparationMinutes,
    scheduledAt: preparationAt,
  });
  return result;
}

export function planRefreshNotification(finishAt: string | Date): Date {
  return new Date(new Date(finishAt).getTime() + 24 * 60 * 60_000);
}

async function rescheduleAccountNotifications(client: pg.PoolClient, accountId: string, now = new Date()): Promise<void> {
  const account = (await client.query("SELECT resource_status,resource_preparation_minutes FROM accounts WHERE id=$1", [accountId])).rows[0];
  if (!account) return;
  await client.query(`
    DELETE FROM upgrade_notifications n USING tracked_upgrades u
    WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.status<>'sent'
      AND (u.status<>'completed' OR n.notification_kind<>'completion')
  `, [accountId]);
  const upgrades = await client.query("SELECT id,finish_at,resource_preparation_override_minutes FROM tracked_upgrades WHERE account_id=$1 AND status='active'", [accountId]);
  for (const upgrade of upgrades.rows) {
    const overrideMinutes = upgrade.resource_preparation_override_minutes == null ? null : Number(upgrade.resource_preparation_override_minutes);
    for (const notification of planResourceNotifications(account.resource_status as ResourceStatus,
      resolvePreparationMinutes(account.resource_preparation_minutes == null ? null : Number(account.resource_preparation_minutes), overrideMinutes), upgrade.finish_at, now)) {
      await client.query(`
        INSERT INTO upgrade_notifications (upgrade_id,minutes_before,notification_kind,preparation_minutes,scheduled_at,next_attempt_at)
        VALUES ($1,$2,$3,$4,$5,$5)
        ON CONFLICT (upgrade_id,notification_kind) WHERE notification_kind<>'legacy' DO NOTHING
      `, [upgrade.id, notification.minutesBefore, notification.kind, notification.preparationMinutes, notification.scheduledAt]);
    }
    const refreshAt = planRefreshNotification(upgrade.finish_at);
    await client.query(`
      INSERT INTO upgrade_notifications (upgrade_id,minutes_before,notification_kind,preparation_minutes,scheduled_at,next_attempt_at)
      VALUES ($1,0,'refresh_required',NULL,$2,$2)
      ON CONFLICT (upgrade_id,notification_kind) WHERE notification_kind<>'legacy' DO NOTHING
    `, [upgrade.id, refreshAt]);
  }
}

export async function updateUpgradePreparationOverride(id: string, overrideMinutes: number | null): Promise<TrackedUpgrade | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`UPDATE tracked_upgrades
      SET resource_preparation_override_minutes=$2,updated_at=now()
      WHERE id=$1 RETURNING *`, [id, overrideMinutes]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    await rescheduleAccountNotifications(client, String(rows[0].account_id));
    await client.query("COMMIT");
    return upgradeFromRow(rows[0]);
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function completeDueTrackedUpgrades(now = new Date()): Promise<TrackedUpgrade[]> {
  const { rows } = await database().query(`
    UPDATE tracked_upgrades SET status='completed',updated_at=now()
    WHERE status='active' AND finish_at <= $1 RETURNING *
  `, [now]);
  return rows.map(upgradeFromRow);
}

export async function syncTrackedUpgrades(accountId: string, source: UpgradeSource, upgrades: Upgrade[], observedAt: string, transactionClient?: pg.PoolClient): Promise<void> {
  const client = transactionClient || await database().connect();
  const ownsTransaction = !transactionClient;
  try {
    if (ownsTransaction) await client.query("BEGIN");
    const keys: string[] = [];
    let trackerChanged = false;
    for (const upgrade of upgrades) {
      const sourceKey = upgrade.id;
      keys.push(sourceKey);
      const existing = (await client.query("SELECT finish_at,status FROM tracked_upgrades WHERE account_id=$1 AND source=$2 AND source_key=$3", [accountId, source, sourceKey])).rows[0];
      const { rows } = await client.query(`
        INSERT INTO tracked_upgrades (account_id,source,source_key,name,type,base,current_level,next_level,started_at,finish_at,status,last_seen_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)
        ON CONFLICT (account_id,source,source_key) DO UPDATE SET
          name=EXCLUDED.name,type=EXCLUDED.type,base=EXCLUDED.base,current_level=EXCLUDED.current_level,next_level=EXCLUDED.next_level,
          started_at=EXCLUDED.started_at,finish_at=EXCLUDED.finish_at,status='active',last_seen_at=EXCLUDED.last_seen_at,updated_at=now()
        RETURNING *
      `, [accountId, source, sourceKey, upgrade.name, upgrade.type, upgrade.base === "builder" ? "builder" : "home", upgrade.level, upgrade.nextLevel,
        upgrade.startedAt || observedAt, upgrade.finishAt, observedAt]);
      if (!existing || existing.status !== "active" || new Date(existing.finish_at).getTime() !== new Date(upgrade.finishAt).getTime()) trackerChanged = true;
      const duplicates = await client.query(`
        UPDATE tracked_upgrades SET status='cancelled',updated_at=now()
        WHERE account_id=$1 AND id<>$2 AND status='active' AND type=$3 AND lower(name)=lower($4) AND next_level=$5
        RETURNING id
      `, [accountId, rows[0].id, upgrade.type, upgrade.name, upgrade.nextLevel]);
      if (duplicates.rowCount) trackerChanged = true;
      for (const row of duplicates.rows) await client.query("DELETE FROM upgrade_notifications WHERE upgrade_id=$1 AND status <> 'sent'", [row.id]);
    }
    const result = await client.query(`
      UPDATE tracked_upgrades SET status=CASE WHEN finish_at <= $4 THEN 'completed' ELSE 'cancelled' END,updated_at=now()
      WHERE account_id=$1 AND source=$2 AND status='active' AND NOT (source_key = ANY($3::text[])) RETURNING id,status
    `, [accountId, source, keys, observedAt]);
    if (result.rowCount) trackerChanged = true;
    for (const row of result.rows) await client.query(`DELETE FROM upgrade_notifications
      WHERE upgrade_id=$1 AND status<>'sent' AND ($2<>'completed' OR notification_kind<>'completion')`, [row.id, row.status]);
    if (trackerChanged) await rescheduleAccountNotifications(client, accountId);
    if (ownsTransaction) await client.query("COMMIT");
  } catch (error) { if (ownsTransaction) await client.query("ROLLBACK"); throw error; } finally { if (ownsTransaction) client.release(); }
}

export async function claimDueNotifications(limit = 20, now = new Date()): Promise<DueNotification[]> {
  await database().query(`
    UPDATE upgrade_notifications SET status='skipped',locked_at=NULL,last_error='reminder window missed',updated_at=now()
    WHERE notification_kind='one_minute' AND status IN ('pending','processing') AND scheduled_at < $1::timestamptz - interval '2 minutes'
  `, [now]);
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const candidates = await client.query(`
      SELECT n.id,n.upgrade_id,n.notification_kind,n.minutes_before,n.preparation_minutes,
        a.id AS account_id,a.label AS account_name,u.name AS upgrade_name,u.next_level,u.finish_at
      FROM upgrade_notifications n
      JOIN tracked_upgrades u ON u.id=n.upgrade_id JOIN accounts a ON a.id=u.account_id
      WHERE u.status IN ('active','completed') AND n.scheduled_at <= $1 AND n.next_attempt_at <= $1
        AND (n.status='pending' OR (n.status='processing' AND n.locked_at < $1 - interval '5 minutes'))
        AND (n.notification_kind<>'refresh_required' OR NOT EXISTS (
          SELECT 1 FROM village_exports e WHERE e.account_id=u.account_id AND e.exported_at>u.finish_at
          UNION ALL
          SELECT 1 FROM snapshot_logs s WHERE s.account_id=u.account_id AND s.captured_at>u.finish_at
        ))
      ORDER BY n.scheduled_at FOR UPDATE OF n SKIP LOCKED LIMIT $2
    `, [now, limit]);
    const claimed: pg.QueryResultRow[] = [];
    const refreshAccounts = new Set<string>();
    for (const row of candidates.rows) {
      if (row.notification_kind === "refresh_required" && refreshAccounts.has(String(row.account_id))) {
        await client.query("UPDATE upgrade_notifications SET status='skipped',last_error='refresh reminder deduplicated',updated_at=now() WHERE id=$1", [row.id]);
        continue;
      }
      if (row.notification_kind === "resource_preparation") {
        const suppression = await client.query(`
          INSERT INTO resource_reminder_suppressions (account_id,notification_id,suppress_until,preparation_minutes)
          VALUES ($1,$2,$3::timestamptz + ($4 * interval '1 minute'),$4)
          ON CONFLICT (account_id) DO UPDATE SET notification_id=EXCLUDED.notification_id,
            suppress_until=EXCLUDED.suppress_until,preparation_minutes=EXCLUDED.preparation_minutes,updated_at=now()
          WHERE resource_reminder_suppressions.suppress_until <= $3 OR resource_reminder_suppressions.notification_id=$2
          RETURNING notification_id
        `, [row.account_id, row.id, now, row.preparation_minutes]);
        if (!suppression.rowCount) {
          await client.query("UPDATE upgrade_notifications SET status='skipped',last_error='resource reminder suppressed',updated_at=now() WHERE id=$1", [row.id]);
          continue;
        }
      }
      await client.query("UPDATE upgrade_notifications SET status='processing',locked_at=$2,attempts=attempts+1,updated_at=now() WHERE id=$1", [row.id, now]);
      if (row.notification_kind === "refresh_required") {
        refreshAccounts.add(String(row.account_id));
        await client.query(`
          UPDATE upgrade_notifications n SET status='skipped',last_error='refresh reminder deduplicated',updated_at=now()
          FROM tracked_upgrades u WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.id<>$2
            AND n.notification_kind='refresh_required' AND n.status='pending' AND n.scheduled_at<=$3
        `, [row.account_id, row.id, now]);
      }
      claimed.push(row);
    }
    await client.query("COMMIT");
    return claimed.map((row) => ({
      id: String(row.id), upgradeId: String(row.upgrade_id), kind: row.notification_kind as NotificationKind,
      minutesBefore: Number(row.minutes_before), preparationMinutes: row.preparation_minutes == null ? null : Number(row.preparation_minutes),
      minutesRemaining: Math.max(0, Math.ceil((new Date(row.finish_at).getTime() - now.getTime()) / 60_000)),
      accountName: row.account_name, upgradeName: row.upgrade_name, nextLevel: row.next_level, finishAt: new Date(row.finish_at).toISOString(),
    }));
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function markNotificationSent(id: string, now = new Date()): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE upgrade_notifications SET status='sent',sent_at=$2,locked_at=NULL,last_error=NULL,updated_at=now() WHERE id=$1", [id, now]);
    await client.query(`UPDATE resource_reminder_suppressions
      SET suppress_until=$2::timestamptz + (preparation_minutes * interval '1 minute'),updated_at=now()
      WHERE notification_id=$1`, [id, now]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function markNotificationFailed(id: string, error: string, now = new Date()): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM resource_reminder_suppressions WHERE notification_id=$1", [id]);
    await client.query(`UPDATE upgrade_notifications SET status='pending',locked_at=NULL,last_error=$2,
      next_attempt_at=$3 + LEAST(attempts * interval '30 seconds', interval '15 minutes'),updated_at=now() WHERE id=$1`, [id, error.slice(0, 500), now]);
    await client.query("COMMIT");
  } catch (failure) { await client.query("ROLLBACK"); throw failure; } finally { client.release(); }
}

export async function latestVillageExport(accountId: string): Promise<{ exportedAt: string; normalized: ExportData; raw: unknown } | null> {
  const { rows } = await database().query("SELECT * FROM village_exports WHERE account_id=$1 ORDER BY exported_at DESC LIMIT 1", [accountId]);
  return rows[0] ? { exportedAt: new Date(rows[0].exported_at).toISOString(), normalized: rows[0].normalized as ExportData, raw: rows[0].raw as unknown } : null;
}

export async function listLatestVillageExports(): Promise<Array<{ accountId: string; exportedAt: string; normalized: ExportData; raw: unknown }>> {
  const { rows } = await database().query(`
    SELECT DISTINCT ON (account_id) account_id,exported_at,normalized,raw
    FROM village_exports ORDER BY account_id,exported_at DESC
  `);
  return rows.map((row: pg.QueryResultRow) => ({ accountId: String(row.account_id), exportedAt: new Date(row.exported_at).toISOString(), normalized: row.normalized as ExportData, raw: row.raw as unknown }));
}

export async function saveVillageExport(accountId: string, parsed: ExportData, options: { resourceStatus?: ResourceStatus } = {}): Promise<{ exportedAt: string; normalized: ExportData; raw: unknown } | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM village_exports WHERE account_id=$1 ORDER BY exported_at DESC LIMIT 1 FOR UPDATE", [accountId]);
    const row = result.rows[0];
    const latest = row ? { exportedAt: new Date(row.exported_at).toISOString(), normalized: row.normalized as ExportData, raw: row.raw as unknown } : null;
    if (latest && new Date(parsed.exportedAt) <= new Date(latest.exportedAt)) throw new Error("village export is not newer than the stored export");
    const currentBuilderBase = parsed.upgradeSlots?.builderBase?.builders;
    const previousBuilderBase = latest?.normalized.upgradeSlots?.builderBase?.builders;
    if (currentBuilderBase && previousBuilderBase && previousBuilderBase.total > currentBuilderBase.total) {
      const busy = currentBuilderBase.total - currentBuilderBase.free;
      currentBuilderBase.total = previousBuilderBase.total;
      currentBuilderBase.free = Math.max(0, currentBuilderBase.total - busy);
    }
    await client.query(`
      INSERT INTO village_exports (account_id,player_tag,exported_at,raw,normalized)
      VALUES ($1,$2,$3,$4,$5)
    `, [accountId, parsed.tag, parsed.exportedAt, parsed.raw, {
      tag: parsed.tag, exportedAt: parsed.exportedAt, townHall: parsed.townHall,
      builders: parsed.builders, upgradeSlots: parsed.upgradeSlots, cooldowns: parsed.cooldowns, helpers: parsed.helpers, heroEquipment: parsed.heroEquipment, upgrades: parsed.upgrades, unknownDataIds: parsed.unknownDataIds,
    }]);
    const account = parsed.upgrades.length > 0
      ? (await client.query("SELECT resource_status FROM accounts WHERE id=$1 FOR UPDATE", [accountId])).rows[0]
      : null;
    const nextResourceStatus = options.resourceStatus || "unanswered";
    if (account) await client.query(`UPDATE accounts SET resource_status=$2,resource_status_updated_at=now(),updated_at=now() WHERE id=$1`, [accountId, nextResourceStatus]);
    await syncTrackedUpgrades(accountId, "export", parsed.upgrades, parsed.exportedAt, client);
    if (account && account.resource_status !== nextResourceStatus) await rescheduleAccountNotifications(client, accountId);
    await client.query("COMMIT");
    return latest;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function saveSnapshotLog(accountId: string, snapshot: VillageSnapshot, source: SnapshotDocument): Promise<void> {
  await database().query(`
    INSERT INTO snapshot_logs (account_id,captured_at,data_source,snapshot,source)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (account_id,captured_at,data_source) DO NOTHING
  `, [accountId, snapshot.lastSeen, snapshot.dataSource, snapshot, source]);
}

export async function listLatestSnapshotLogs(): Promise<Array<{ accountId: string; snapshot: VillageSnapshot }>> {
  const { rows } = await database().query(`
    SELECT DISTINCT ON (account_id) account_id,snapshot
    FROM snapshot_logs ORDER BY account_id,captured_at DESC
  `);
  return rows.map((row) => ({ accountId: String(row.account_id), snapshot: row.snapshot as VillageSnapshot }));
}

export async function listSnapshotHistoryLogs(accountId: string, limit = 100): Promise<Array<{ capturedAt: string; snapshot: VillageSnapshot; source: SnapshotDocument }>> {
  const { rows } = await database().query(`
    SELECT captured_at,snapshot,source FROM snapshot_logs
    WHERE account_id=$1 ORDER BY captured_at DESC LIMIT $2
  `, [accountId, limit]);
  return rows.map((row) => ({ capturedAt: new Date(row.captured_at).toISOString(), snapshot: row.snapshot as VillageSnapshot, source: row.source as SnapshotDocument }));
}

export async function exportVillageHistories(selector?: string): Promise<VillageHistoryBundle[]> {
  const selected = selector?.trim() || null;
  const { rows: accountRows } = await database().query(`
    SELECT * FROM accounts
    WHERE $1::text IS NULL OR id::text=$1 OR upper(player_tag)=upper($1) OR lower(label)=lower($1)
    ORDER BY lower(label),created_at
  `, [selected]);
  const bundles: VillageHistoryBundle[] = [];
  for (const row of accountRows) {
    const [snapshots, exports, settings] = await Promise.all([
      database().query("SELECT captured_at,data_source,snapshot,source FROM snapshot_logs WHERE account_id=$1 ORDER BY captured_at", [row.id]),
      database().query("SELECT player_tag,exported_at,raw,normalized FROM village_exports WHERE account_id=$1 ORDER BY exported_at", [row.id]),
      database().query("SELECT source,source_key,notification_offsets,resource_preparation_override_minutes FROM tracked_upgrades WHERE account_id=$1 ORDER BY source,source_key", [row.id]),
    ]);
    bundles.push({
      format: "multi-coc-village-history", version: 1, exportedAt: new Date().toISOString(),
      account: {
        id: String(row.id), label: row.label, playerTag: row.player_tag, color: row.color, tags: (row.tags as string[] || []).map(String),
        resourceStatus: row.resource_status as ResourceStatus,
        resourceStatusUpdatedAt: new Date(row.resource_status_updated_at).toISOString(),
        resourcePreparationMinutes: row.resource_preparation_minutes == null ? null : Number(row.resource_preparation_minutes),
      },
      snapshots: snapshots.rows.map((item) => ({ capturedAt: new Date(item.captured_at).toISOString(), dataSource: item.data_source, snapshot: item.snapshot as VillageSnapshot, source: item.source as SnapshotDocument })),
      villageExports: exports.rows.map((item) => ({ playerTag: item.player_tag, exportedAt: new Date(item.exported_at).toISOString(), raw: item.raw as unknown, normalized: item.normalized as ExportData })),
      upgradeSettings: settings.rows.map((item) => ({ source: item.source as UpgradeSource, sourceKey: item.source_key, notificationOffsets: normalizeOffsets(item.notification_offsets as number[]), resourcePreparationOverrideMinutes: item.resource_preparation_override_minutes == null ? null : Number(item.resource_preparation_override_minutes) })),
    });
  }
  return bundles;
}

export async function importVillageHistory(bundle: VillageHistoryBundle): Promise<VillageHistoryImportResult> {
  if (bundle.format !== "multi-coc-village-history" || bundle.version !== 1) throw new Error("unsupported village history format");
  if (!bundle.account?.label || !Array.isArray(bundle.snapshots) || !Array.isArray(bundle.villageExports)) throw new Error("invalid village history bundle");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const playerTag = String(bundle.account.playerTag || "");
    let accountRow = playerTag ? (await client.query("SELECT * FROM accounts WHERE upper(player_tag)=upper($1)", [playerTag])).rows[0] : null;
    if (!accountRow && !playerTag && bundle.account.id) accountRow = (await client.query("SELECT * FROM accounts WHERE id::text=$1", [bundle.account.id])).rows[0];
    let created = false;
    if (!accountRow) {
      const validOriginalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bundle.account.id);
      const idTaken = validOriginalId && (await client.query("SELECT 1 FROM accounts WHERE id::text=$1", [bundle.account.id])).rowCount;
      const id = validOriginalId && !idTaken ? bundle.account.id : randomUUID();
      const result = await client.query(`
        INSERT INTO accounts (id,label,player_tag,color,tags,resource_status,resource_status_updated_at,resource_preparation_minutes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [id, bundle.account.label, playerTag, bundle.account.color || "#4c9a79", bundle.account.tags || [],
        bundle.account.resourceStatus || "unanswered", bundle.account.resourceStatusUpdatedAt || new Date().toISOString(),
        bundle.account.resourcePreparationMinutes === undefined ? 60 : bundle.account.resourcePreparationMinutes]);
      accountRow = result.rows[0];
      created = true;
    }
    const accountId = String(accountRow.id);
    const existingUpgradeKeys = new Set((await client.query("SELECT source,source_key FROM tracked_upgrades WHERE account_id=$1", [accountId])).rows.map((row) => `${row.source}:${row.source_key}`));
    let snapshotCount = 0; let exportCount = 0;
    for (const item of bundle.snapshots) {
      const result = await client.query(`
        INSERT INTO snapshot_logs (account_id,captured_at,data_source,snapshot,source)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (account_id,captured_at,data_source) DO NOTHING
      `, [accountId, item.capturedAt, item.dataSource, item.snapshot, item.source]);
      snapshotCount += result.rowCount || 0;
    }
    for (const item of bundle.villageExports) {
      const result = await client.query(`
        INSERT INTO village_exports (account_id,player_tag,exported_at,raw,normalized)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (account_id,exported_at) DO NOTHING
      `, [accountId, item.playerTag || playerTag, item.exportedAt, item.raw, item.normalized]);
      exportCount += result.rowCount || 0;
    }
    const timeline: Array<{ source: UpgradeSource; observedAt: string; upgrades: Upgrade[] }> = [];
    const latestExport = await client.query("SELECT exported_at,normalized FROM village_exports WHERE account_id=$1 ORDER BY exported_at DESC LIMIT 1", [accountId]);
    if (latestExport.rows[0]) timeline.push({ source: "export", observedAt: new Date(latestExport.rows[0].exported_at).toISOString(), upgrades: (latestExport.rows[0].normalized as ExportData).upgrades || [] });
    const latestSnapshot = await client.query("SELECT captured_at,snapshot FROM snapshot_logs WHERE account_id=$1 ORDER BY captured_at DESC LIMIT 1", [accountId]);
    if (latestSnapshot.rows[0]) timeline.push({ source: "snapshot", observedAt: new Date(latestSnapshot.rows[0].captured_at).toISOString(), upgrades: (latestSnapshot.rows[0].snapshot as VillageSnapshot).upgrades || [] });
    for (const item of timeline.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime())) {
      await syncTrackedUpgrades(accountId, item.source, item.upgrades, item.observedAt, client);
    }
    for (const setting of bundle.upgradeSettings || []) {
      if (existingUpgradeKeys.has(`${setting.source}:${setting.sourceKey}`)) continue;
      const offsets = normalizeOffsets(setting.notificationOffsets);
      await client.query(`
        UPDATE tracked_upgrades SET notification_offsets=$4,resource_preparation_override_minutes=$5,updated_at=now()
        WHERE account_id=$1 AND source=$2 AND source_key=$3
      `, [accountId, setting.source, setting.sourceKey, offsets, setting.resourcePreparationOverrideMinutes ?? null]);
    }
    await client.query(`
      DELETE FROM upgrade_notifications n USING tracked_upgrades u
      WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.status<>'sent'
        AND n.notification_kind='one_minute' AND n.scheduled_at<=now()
    `, [accountId]);
    await client.query("UPDATE tracked_upgrades SET status='completed',updated_at=now() WHERE account_id=$1 AND status='active' AND finish_at<=now()", [accountId]);
    await rescheduleAccountNotifications(client, accountId);
    await client.query("COMMIT");
    return { accountId, label: accountRow.label, created, snapshots: snapshotCount, villageExports: exportCount };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export async function cleanupDatabaseLogs({ snapshotDays = 90, now = new Date() }: { snapshotDays?: number; now?: Date } = {}): Promise<{ snapshots: number }> {
  const snapshots = snapshotDays > 0
    ? await database().query("DELETE FROM snapshot_logs WHERE captured_at < $1::timestamptz - ($2 * interval '1 day')", [now, snapshotDays])
    : null;
  return { snapshots: snapshots?.rowCount || 0 };
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
