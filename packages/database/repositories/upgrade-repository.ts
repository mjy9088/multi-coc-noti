import type { UpgradeType } from "@multi-coc/shared";
import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { drizzleDatabase } from "../client.ts";
import { trackedUpgrades } from "../schema.ts";
import type { TrackedUpgrade, UpgradeSource } from "../types.ts";

export const upgradeFromRow = (row: typeof trackedUpgrades.$inferSelect): TrackedUpgrade => ({
  id: String(row.id),
  accountId: row.accountId,
  name: String(row.name),
  type: row.type as UpgradeType,
  base: row.base === "builder" ? "builder" : "home",
  level: row.currentLevel,
  nextLevel: row.nextLevel,
  startedAt: row.startedAt.toISOString(),
  finishAt: row.finishAt.toISOString(),
  status: row.status,
  source: row.source as UpgradeSource,
  sourceKey: row.sourceKey,
  notificationOffsets: row.notificationOffsets.map(Number),
  resourcePreparationOverrideMinutes:
    row.resourcePreparationOverrideMinutes == null ? null : Number(row.resourcePreparationOverrideMinutes),
});

export async function listTrackedUpgrades({
  activeOnly = false,
  accountIds,
}: {
  activeOnly?: boolean;
  accountIds?: string[];
} = {}): Promise<TrackedUpgrade[]> {
  if (accountIds?.length === 0) return [];
  const query = drizzleDatabase().select().from(trackedUpgrades).orderBy(trackedUpgrades.finishAt);
  const rows = await query.where(
    and(
      activeOnly ? eq(trackedUpgrades.status, "active") : undefined,
      accountIds ? inArray(trackedUpgrades.accountId, accountIds) : undefined,
    ),
  );
  return rows.map(upgradeFromRow);
}

export async function listUpgradeHistory({
  accountId,
  limit = 100,
  before,
  base,
  active,
  type,
  accountIds,
}: {
  accountId?: string;
  limit?: number;
  before?: string;
  base?: "home" | "builder";
  active?: boolean;
  type?: UpgradeType;
  accountIds?: string[];
} = {}): Promise<TrackedUpgrade[]> {
  if (accountIds?.length === 0) return [];
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit) || 100));
  const cursor = before == null ? null : Number(before);
  if (cursor != null && (!Number.isSafeInteger(cursor) || cursor <= 0))
    throw new Error("invalid upgrade history cursor");
  const conditions = [
    accountId ? eq(trackedUpgrades.accountId, accountId) : undefined,
    accountIds ? inArray(trackedUpgrades.accountId, accountIds) : undefined,
    cursor ? lt(trackedUpgrades.id, cursor) : undefined,
    base ? eq(trackedUpgrades.base, base) : undefined,
    active == null ? undefined : active ? eq(trackedUpgrades.status, "active") : ne(trackedUpgrades.status, "active"),
    type ? eq(trackedUpgrades.type, type) : undefined,
  ];
  const rows = await drizzleDatabase()
    .select()
    .from(trackedUpgrades)
    .where(and(...conditions))
    .orderBy(desc(trackedUpgrades.id))
    .limit(boundedLimit);
  return rows.map(upgradeFromRow);
}
