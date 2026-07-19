import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { drizzleDatabase } from "../client.ts";
import { villageExports } from "../schema.ts";
import type { ExportData, SyncHistoryEntry } from "../types.ts";

export async function listSyncHistory({
  accountId,
  limit = 100,
  before,
  accountIds,
}: {
  accountId?: string;
  limit?: number;
  before?: string;
  accountIds?: string[];
} = {}): Promise<SyncHistoryEntry[]> {
  if (accountIds?.length === 0) return [];
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit) || 100));
  const cursor = before == null ? null : Number(before);
  if (cursor != null && (!Number.isSafeInteger(cursor) || cursor <= 0)) throw new Error("invalid sync history cursor");
  const rows = await drizzleDatabase()
    .select()
    .from(villageExports)
    .where(
      and(
        accountId ? eq(villageExports.accountId, accountId) : undefined,
        accountIds ? inArray(villageExports.accountId, accountIds) : undefined,
        cursor ? lt(villageExports.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(villageExports.id))
    .limit(boundedLimit);
  return rows.map((row) => {
    const normalized = row.normalized as ExportData;
    const upgrades = normalized.upgrades || [];
    return {
      id: String(row.id),
      accountId: row.accountId,
      playerTag: row.playerTag,
      exportedAt: row.exportedAt.toISOString(),
      importedAt: row.importedAt.toISOString(),
      townHall: Number(normalized.townHall || 0),
      upgrades: upgrades.length,
      homeUpgrades: upgrades.filter((upgrade) => upgrade.base !== "builder").length,
      builderUpgrades: upgrades.filter((upgrade) => upgrade.base === "builder").length,
      builders: {
        free: Number(normalized.builders?.free || 0),
        total: Number(normalized.builders?.total || 0),
      },
      unknownDataIds: normalized.unknownDataIds?.length || 0,
    };
  });
}

export async function latestVillageExport(
  accountId: string,
): Promise<{ exportedAt: string; normalized: ExportData; raw: unknown } | null> {
  const rows = await drizzleDatabase()
    .select()
    .from(villageExports)
    .where(eq(villageExports.accountId, accountId))
    .orderBy(desc(villageExports.exportedAt))
    .limit(1);
  return rows[0]
    ? {
        exportedAt: rows[0].exportedAt.toISOString(),
        normalized: rows[0].normalized as ExportData,
        raw: rows[0].raw as unknown,
      }
    : null;
}

export async function listLatestVillageExports(
  accountIds?: string[],
): Promise<Array<{ accountId: string; exportedAt: string; normalized: ExportData; raw: unknown }>> {
  if (accountIds?.length === 0) return [];
  const rows = await drizzleDatabase()
    .selectDistinctOn([villageExports.accountId])
    .from(villageExports)
    .where(accountIds ? inArray(villageExports.accountId, accountIds) : undefined)
    .orderBy(villageExports.accountId, desc(villageExports.exportedAt));
  return rows.map((row) => ({
    accountId: row.accountId,
    exportedAt: row.exportedAt.toISOString(),
    normalized: row.normalized as ExportData,
    raw: row.raw as unknown,
  }));
}
