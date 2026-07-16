import pg from "pg";
import { readFile } from "node:fs/promises";
import type { Account, SnapshotDocument, Upgrade, UpgradeType, VillageEvent, VillageSnapshot } from "@multi-coc/shared";

const { Pool } = pg;
let pool: pg.Pool | undefined;

type AccountInput = Omit<Account, "id" | "legacyIndex">;
export type ManualUpgrade = Upgrade & { accountId: string; startedAt: string; status: string };
type ManualUpgradeInput = Omit<ManualUpgrade, "id">;
type ExportData = {
  tag: string; exportedAt: string; townHall: number; builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: VillageSnapshot["upgradeSlots"];
  upgrades: Upgrade[]; unknownDataIds: number[]; raw: unknown;
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
  color: row.color, apiKey: row.api_key, sourceUrl: row.source_url, clashApiToken: row.clash_api_token,
});

export async function listAccounts() {
  const { rows } = await database().query("SELECT * FROM accounts ORDER BY lower(label), created_at");
  return rows.map(accountFromRow);
}

export async function createAccount(value: AccountInput): Promise<Account> {
  const { rows } = await database().query(`
    INSERT INTO accounts (label, player_tag, color, api_key, source_url, clash_api_token)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
  `, [value.label, value.playerTag || "", value.color || "#4c9a79", value.apiKey, value.sourceUrl || "", value.clashApiToken || ""]);
  return accountFromRow(rows[0]);
}

export async function updateAccount(id: string, value: AccountInput): Promise<Account | null> {
  const { rows } = await database().query(`
    UPDATE accounts SET label=$2, player_tag=$3, color=$4, api_key=$5,
      source_url=$6, clash_api_token=$7, updated_at=now()
    WHERE id=$1 RETURNING *
  `, [id, value.label, value.playerTag || "", value.color || "#4c9a79", value.apiKey, value.sourceUrl || "", value.clashApiToken || ""]);
  return rows[0] ? accountFromRow(rows[0]) : null;
}

export async function deleteAccount(id: string): Promise<boolean> {
  const result = await database().query("DELETE FROM accounts WHERE id=$1", [id]);
  return (result.rowCount || 0) > 0;
}

export async function clearLegacyIndex(id: string): Promise<void> {
  await database().query("UPDATE accounts SET legacy_index=NULL WHERE id=$1", [id]);
}

const upgradeFromRow = (row: pg.QueryResultRow): ManualUpgrade => ({
  id: String(row.id), accountId: String(row.account_id), name: String(row.name), type: row.type as UpgradeType,
  level: row.current_level, nextLevel: row.next_level,
  startedAt: new Date(row.started_at).toISOString(), finishAt: new Date(row.finish_at).toISOString(), status: row.status,
});

export async function listManualUpgrades({ activeOnly = false } = {}): Promise<ManualUpgrade[]> {
  const where = activeOnly ? "WHERE status='active'" : "";
  const { rows } = await database().query(`SELECT * FROM manual_upgrades ${where} ORDER BY finish_at`);
  return rows.map(upgradeFromRow);
}

export async function createManualUpgrade(value: ManualUpgradeInput): Promise<ManualUpgrade> {
  const { rows } = await database().query(`
    INSERT INTO manual_upgrades (account_id,name,type,current_level,next_level,started_at,finish_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [value.accountId, value.name, value.type, value.level, value.nextLevel, value.startedAt, value.finishAt]);
  return upgradeFromRow(rows[0]);
}

export async function setManualUpgradeStatus(id: string, status: string): Promise<ManualUpgrade | null> {
  const { rows } = await database().query("UPDATE manual_upgrades SET status=$2,updated_at=now() WHERE id=$1 RETURNING *", [id, status]);
  return rows[0] ? upgradeFromRow(rows[0]) : null;
}

export async function updateManualUpgrade(id: string, value: Partial<Omit<ManualUpgrade, "id" | "accountId">>): Promise<ManualUpgrade | null> {
  const { rows } = await database().query(`
    UPDATE manual_upgrades SET
      name=COALESCE($2,name), type=COALESCE($3,type), current_level=COALESCE($4,current_level),
      next_level=COALESCE($5,next_level), started_at=COALESCE($6,started_at),
      finish_at=COALESCE($7,finish_at), status=COALESCE($8,status), updated_at=now()
    WHERE id=$1 RETURNING *
  `, [id, value.name ?? null, value.type ?? null, value.level ?? null, value.nextLevel ?? null,
    value.startedAt ?? null, value.finishAt ?? null, value.status ?? null]);
  return rows[0] ? upgradeFromRow(rows[0]) : null;
}

export async function completeDueManualUpgrades(now = new Date()): Promise<ManualUpgrade[]> {
  const { rows } = await database().query(`
    UPDATE manual_upgrades SET status='completed',updated_at=now()
    WHERE status='active' AND finish_at <= $1 RETURNING *
  `, [now]);
  return rows.map(upgradeFromRow);
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
  const latest = await latestVillageExport(accountId);
  if (latest && new Date(parsed.exportedAt) <= new Date(latest.exportedAt)) throw new Error("village export is not newer than the stored export");
  const currentBuilderBase = parsed.upgradeSlots?.builderBase?.builders;
  const previousBuilderBase = latest?.normalized.upgradeSlots?.builderBase?.builders;
  if (currentBuilderBase && previousBuilderBase && previousBuilderBase.total > currentBuilderBase.total) {
    const busy = currentBuilderBase.total - currentBuilderBase.free;
    currentBuilderBase.total = previousBuilderBase.total;
    currentBuilderBase.free = Math.max(0, currentBuilderBase.total - busy);
  }
  await database().query(`
    INSERT INTO village_exports (account_id,player_tag,exported_at,raw,normalized)
    VALUES ($1,$2,$3,$4,$5)
  `, [accountId, parsed.tag, parsed.exportedAt, parsed.raw, {
    tag: parsed.tag, exportedAt: parsed.exportedAt, townHall: parsed.townHall,
    builders: parsed.builders, upgradeSlots: parsed.upgradeSlots, upgrades: parsed.upgrades, unknownDataIds: parsed.unknownDataIds,
  }]);
  return latest;
}

export async function saveSnapshotLog(accountId: string, snapshot: VillageSnapshot, source: SnapshotDocument): Promise<void> {
  await database().query(`
    INSERT INTO snapshot_logs (account_id,captured_at,data_source,snapshot,source)
    VALUES ($1,$2,$3,$4,$5)
  `, [accountId, snapshot.lastSeen, snapshot.dataSource, snapshot, source]);
}

export async function saveEventLog(event: VillageEvent): Promise<void> {
  await database().query(`
    INSERT INTO event_logs (event_id,account_id,event_type,occurred_at,payload)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (event_id) DO NOTHING
  `, [event.id, event.accountId, event.type, event.occurredAt, event]);
}

export async function cleanupDatabaseLogs({ snapshotDays = 90, eventDays = 90, now = new Date() }: { snapshotDays?: number; eventDays?: number; now?: Date } = {}): Promise<{ snapshots: number; events: number }> {
  const snapshots = snapshotDays > 0
    ? await database().query("DELETE FROM snapshot_logs WHERE captured_at < $1::timestamptz - ($2 * interval '1 day')", [now, snapshotDays])
    : null;
  const events = eventDays > 0
    ? await database().query("DELETE FROM event_logs WHERE occurred_at < $1::timestamptz - ($2 * interval '1 day')", [now, eventDays])
    : null;
  return { snapshots: snapshots?.rowCount || 0, events: events?.rowCount || 0 };
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
