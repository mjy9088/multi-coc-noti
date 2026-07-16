import pg from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Account, SnapshotDocument, Upgrade, UpgradeType, VillageSnapshot } from "@multi-coc/shared";

const { Pool } = pg;
let pool: pg.Pool | undefined;

type AccountInput = Omit<Account, "id" | "legacyIndex">;
export type UpgradeSource = "export" | "snapshot";
export type TrackedUpgrade = Upgrade & {
  accountId: string; startedAt: string; status: string; source: UpgradeSource;
  sourceKey: string; notificationOffsets: number[];
};
export type DueNotification = {
  id: string; upgradeId: string; minutesBefore: number; accountName: string;
  upgradeName: string; nextLevel: number; finishAt: string;
};
type ExportData = {
  tag: string; exportedAt: string; townHall: number; builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: VillageSnapshot["upgradeSlots"];
  upgrades: Upgrade[]; unknownDataIds: number[]; raw: unknown;
};
export type VillageHistoryBundle = {
  format: "multi-coc-village-history";
  version: 1;
  exportedAt: string;
  account: { id: string; label: string; playerTag: string; color: string; tags?: string[] };
  snapshots: Array<{ capturedAt: string; dataSource: string; snapshot: VillageSnapshot; source: SnapshotDocument }>;
  villageExports: Array<{ playerTag: string; exportedAt: string; raw: unknown; normalized: ExportData }>;
  upgradeSettings: Array<{ source: UpgradeSource; sourceKey: string; notificationOffsets: number[] }>;
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
  color: row.color, tags: (row.tags as string[] || []).map(String), apiKey: row.api_key, sourceUrl: row.source_url,
});

export async function listAccounts() {
  const { rows } = await database().query("SELECT * FROM accounts ORDER BY lower(label), created_at");
  return rows.map(accountFromRow);
}

export async function createAccount(value: AccountInput): Promise<Account> {
  const { rows } = await database().query(`
    INSERT INTO accounts (label, player_tag, color, tags, api_key, source_url)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [value.label, value.playerTag || "", value.color || "#4c9a79", value.tags || [], value.apiKey, value.sourceUrl || ""]);
  return accountFromRow(rows[0]);
}

export async function updateAccount(id: string, value: AccountInput): Promise<Account | null> {
  const { rows } = await database().query(`
    UPDATE accounts SET label=$2, player_tag=$3, color=$4, tags=$5, api_key=$6,
      source_url=$7, updated_at=now()
    WHERE id=$1 RETURNING *
  `, [id, value.label, value.playerTag || "", value.color || "#4c9a79", value.tags || [], value.apiKey, value.sourceUrl || ""]);
  return rows[0] ? accountFromRow(rows[0]) : null;
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
  level: row.current_level, nextLevel: row.next_level,
  startedAt: new Date(row.started_at).toISOString(), finishAt: new Date(row.finish_at).toISOString(), status: row.status,
  source: row.source as UpgradeSource, sourceKey: String(row.source_key),
  notificationOffsets: (row.notification_offsets as number[] || []).map(Number),
});

export async function listTrackedUpgrades({ activeOnly = false } = {}): Promise<TrackedUpgrade[]> {
  const where = activeOnly ? "WHERE status='active'" : "";
  const { rows } = await database().query(`SELECT * FROM tracked_upgrades ${where} ORDER BY finish_at`);
  return rows.map(upgradeFromRow);
}

function normalizeOffsets(offsets: number[] | undefined): number[] {
  return [...new Set((offsets || [60, 1, 0]).map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 525_600))].sort((a, b) => b - a);
}

async function replaceNotifications(client: pg.PoolClient, upgradeId: string, finishAt: string, offsets: number[], now = new Date()): Promise<void> {
  await client.query("DELETE FROM upgrade_notifications WHERE upgrade_id=$1 AND status <> 'sent'", [upgradeId]);
  for (const offset of offsets) {
    const scheduledAt = new Date(new Date(finishAt).getTime() - offset * 60_000);
    if (scheduledAt <= now && offset !== 0) continue;
    await client.query(`
      INSERT INTO upgrade_notifications (upgrade_id,minutes_before,scheduled_at,next_attempt_at)
      VALUES ($1,$2,$3,$3) ON CONFLICT (upgrade_id,minutes_before) DO NOTHING
    `, [upgradeId, offset, scheduledAt]);
  }
}

export async function updateTrackedUpgrade(id: string, value: Partial<Omit<TrackedUpgrade, "id" | "accountId" | "source" | "sourceKey">>): Promise<TrackedUpgrade | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const offsets = value.notificationOffsets ? normalizeOffsets(value.notificationOffsets) : null;
    const { rows } = await client.query(`
    UPDATE tracked_upgrades SET
      name=COALESCE($2,name), type=COALESCE($3,type), current_level=COALESCE($4,current_level),
      next_level=COALESCE($5,next_level), started_at=COALESCE($6,started_at),
      finish_at=COALESCE($7,finish_at), status=COALESCE($8,status),
      notification_offsets=COALESCE($9,notification_offsets), updated_at=now()
    WHERE id=$1 RETURNING *
  `, [id, value.name ?? null, value.type ?? null, value.level ?? null, value.nextLevel ?? null,
    value.startedAt ?? null, value.finishAt ?? null, value.status ?? null, offsets]);
    if (!rows[0]) { await client.query("ROLLBACK"); return null; }
    if (value.finishAt || offsets) await replaceNotifications(client, id, new Date(rows[0].finish_at).toISOString(), offsets || rows[0].notification_offsets);
    if (value.status && value.status !== "active") await client.query("DELETE FROM upgrade_notifications WHERE upgrade_id=$1 AND status <> 'sent'", [id]);
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
    for (const upgrade of upgrades) {
      const sourceKey = upgrade.id;
      keys.push(sourceKey);
      const existing = await client.query("SELECT id,finish_at FROM tracked_upgrades WHERE account_id=$1 AND source=$2 AND source_key=$3", [accountId, source, sourceKey]);
      const { rows } = await client.query(`
        INSERT INTO tracked_upgrades (account_id,source,source_key,name,type,current_level,next_level,started_at,finish_at,status,last_seen_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10)
        ON CONFLICT (account_id,source,source_key) DO UPDATE SET
          name=EXCLUDED.name,type=EXCLUDED.type,current_level=EXCLUDED.current_level,next_level=EXCLUDED.next_level,
          started_at=EXCLUDED.started_at,finish_at=EXCLUDED.finish_at,status='active',last_seen_at=EXCLUDED.last_seen_at,updated_at=now()
        RETURNING *
      `, [accountId, source, sourceKey, upgrade.name, upgrade.type, upgrade.level, upgrade.nextLevel,
        upgrade.startedAt || observedAt, upgrade.finishAt, observedAt]);
      const finishChanged = existing.rows[0] && new Date(existing.rows[0].finish_at).getTime() !== new Date(upgrade.finishAt).getTime();
      if (!existing.rows[0] || finishChanged) await replaceNotifications(client, String(rows[0].id), upgrade.finishAt, rows[0].notification_offsets, new Date(observedAt));
      const duplicates = await client.query(`
        UPDATE tracked_upgrades SET status='cancelled',updated_at=now()
        WHERE account_id=$1 AND id<>$2 AND status='active' AND type=$3 AND lower(name)=lower($4) AND next_level=$5
        RETURNING id
      `, [accountId, rows[0].id, upgrade.type, upgrade.name, upgrade.nextLevel]);
      for (const row of duplicates.rows) await client.query("DELETE FROM upgrade_notifications WHERE upgrade_id=$1 AND status <> 'sent'", [row.id]);
    }
    const result = await client.query(`
      UPDATE tracked_upgrades SET status=CASE WHEN finish_at <= $4 THEN 'completed' ELSE 'cancelled' END,updated_at=now()
      WHERE account_id=$1 AND source=$2 AND status='active' AND NOT (source_key = ANY($3::text[])) RETURNING id
    `, [accountId, source, keys, observedAt]);
    for (const row of result.rows) await client.query("DELETE FROM upgrade_notifications WHERE upgrade_id=$1 AND status <> 'sent'", [row.id]);
    if (ownsTransaction) await client.query("COMMIT");
  } catch (error) { if (ownsTransaction) await client.query("ROLLBACK"); throw error; } finally { if (ownsTransaction) client.release(); }
}

export async function claimDueNotifications(limit = 20, now = new Date()): Promise<DueNotification[]> {
  await database().query(`
    UPDATE upgrade_notifications SET status='skipped',locked_at=NULL,last_error='reminder window missed',updated_at=now()
    WHERE minutes_before > 0 AND status IN ('pending','processing') AND scheduled_at < $1::timestamptz - interval '2 minutes'
  `, [now]);
  const { rows } = await database().query(`
    WITH due AS (
      SELECT n.id FROM upgrade_notifications n
      JOIN tracked_upgrades u ON u.id=n.upgrade_id
      WHERE u.status IN ('active','completed') AND n.scheduled_at <= $1 AND n.next_attempt_at <= $1
        AND (n.status='pending' OR (n.status='processing' AND n.locked_at < $1 - interval '5 minutes'))
      ORDER BY n.scheduled_at FOR UPDATE OF n SKIP LOCKED LIMIT $2
    )
    UPDATE upgrade_notifications n SET status='processing',locked_at=$1,attempts=n.attempts+1,updated_at=now()
    FROM due, tracked_upgrades u, accounts a
    WHERE n.id=due.id AND u.id=n.upgrade_id AND a.id=u.account_id
    RETURNING n.id,n.upgrade_id,n.minutes_before,a.label AS account_name,u.name AS upgrade_name,u.next_level,u.finish_at
  `, [now, limit]);
  return rows.map((row) => ({ id: String(row.id), upgradeId: String(row.upgrade_id), minutesBefore: row.minutes_before,
    accountName: row.account_name, upgradeName: row.upgrade_name, nextLevel: row.next_level, finishAt: new Date(row.finish_at).toISOString() }));
}

export async function markNotificationSent(id: string, now = new Date()): Promise<void> {
  await database().query("UPDATE upgrade_notifications SET status='sent',sent_at=$2,locked_at=NULL,last_error=NULL,updated_at=now() WHERE id=$1", [id, now]);
}

export async function markNotificationFailed(id: string, error: string, now = new Date()): Promise<void> {
  await database().query(`UPDATE upgrade_notifications SET status='pending',locked_at=NULL,last_error=$2,
    next_attempt_at=$3 + LEAST(attempts * interval '30 seconds', interval '15 minutes'),updated_at=now() WHERE id=$1`, [id, error.slice(0, 500), now]);
}

export async function latestVillageExport(accountId: string): Promise<{ exportedAt: string; normalized: ExportData; raw: unknown } | null> {
  const { rows } = await database().query("SELECT * FROM village_exports WHERE account_id=$1 ORDER BY exported_at DESC LIMIT 1", [accountId]);
  return rows[0] ? { exportedAt: new Date(rows[0].exported_at).toISOString(), normalized: rows[0].normalized as ExportData, raw: rows[0].raw as unknown } : null;
}

export async function listLatestVillageExports(): Promise<Array<{ accountId: string; exportedAt: string; normalized: ExportData }>> {
  const { rows } = await database().query(`
    SELECT DISTINCT ON (account_id) account_id,exported_at,normalized
    FROM village_exports ORDER BY account_id,exported_at DESC
  `);
  return rows.map((row: pg.QueryResultRow) => ({ accountId: String(row.account_id), exportedAt: new Date(row.exported_at).toISOString(), normalized: row.normalized as ExportData }));
}

export async function saveVillageExport(accountId: string, parsed: ExportData): Promise<{ exportedAt: string; normalized: ExportData; raw: unknown } | null> {
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
      builders: parsed.builders, upgradeSlots: parsed.upgradeSlots, upgrades: parsed.upgrades, unknownDataIds: parsed.unknownDataIds,
    }]);
    await syncTrackedUpgrades(accountId, "export", parsed.upgrades, parsed.exportedAt, client);
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
      database().query("SELECT source,source_key,notification_offsets FROM tracked_upgrades WHERE account_id=$1 ORDER BY source,source_key", [row.id]),
    ]);
    bundles.push({
      format: "multi-coc-village-history", version: 1, exportedAt: new Date().toISOString(),
      account: { id: String(row.id), label: row.label, playerTag: row.player_tag, color: row.color, tags: (row.tags as string[] || []).map(String) },
      snapshots: snapshots.rows.map((item) => ({ capturedAt: new Date(item.captured_at).toISOString(), dataSource: item.data_source, snapshot: item.snapshot as VillageSnapshot, source: item.source as SnapshotDocument })),
      villageExports: exports.rows.map((item) => ({ playerTag: item.player_tag, exportedAt: new Date(item.exported_at).toISOString(), raw: item.raw as unknown, normalized: item.normalized as ExportData })),
      upgradeSettings: settings.rows.map((item) => ({ source: item.source as UpgradeSource, sourceKey: item.source_key, notificationOffsets: normalizeOffsets(item.notification_offsets as number[]) })),
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
        INSERT INTO accounts (id,label,player_tag,color,tags,api_key,source_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [id, bundle.account.label, playerTag, bundle.account.color || "#4c9a79", bundle.account.tags || [], randomUUID(), ""]);
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
      const result = await client.query(`
        UPDATE tracked_upgrades SET notification_offsets=$4,updated_at=now()
        WHERE account_id=$1 AND source=$2 AND source_key=$3 RETURNING id,finish_at,status
      `, [accountId, setting.source, setting.sourceKey, offsets]);
      if (result.rows[0]?.status === "active") await replaceNotifications(client, String(result.rows[0].id), new Date(result.rows[0].finish_at).toISOString(), offsets);
    }
    await client.query(`
      DELETE FROM upgrade_notifications n USING tracked_upgrades u
      WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.status<>'sent' AND n.scheduled_at<=now()
    `, [accountId]);
    await client.query("UPDATE tracked_upgrades SET status='completed',updated_at=now() WHERE account_id=$1 AND status='active' AND finish_at<=now()", [accountId]);
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
