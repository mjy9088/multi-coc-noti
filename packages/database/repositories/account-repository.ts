import type { Account, ResourceStatus } from "@multi-coc/shared";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzleDatabase } from "../client.ts";
import { accounts } from "../schema.ts";
import type { AccountInput } from "../types.ts";

const toAccount = (row: typeof accounts.$inferSelect): Account => ({
  id: row.id,
  userId: row.userId,
  legacyIndex: row.legacyIndex,
  label: row.label,
  playerTag: row.playerTag,
  color: row.color,
  tags: row.tags,
  resourceStatus: row.resourceStatus as ResourceStatus,
  resourceStatusUpdatedAt: row.resourceStatusUpdatedAt.toISOString(),
  resourcePreparationMinutes: row.resourcePreparationMinutes,
});

export async function listAccounts(userId?: string): Promise<Account[]> {
  const rows = await drizzleDatabase()
    .select()
    .from(accounts)
    .where(userId ? eq(accounts.userId, userId) : undefined)
    .orderBy(asc(sql`lower(${accounts.label})`), accounts.createdAt);
  return rows.map(toAccount);
}

export async function createAccount(value: AccountInput, userId: string | null = null): Promise<Account> {
  const [row] = await drizzleDatabase()
    .insert(accounts)
    .values({
      userId,
      label: value.label,
      playerTag: value.playerTag || "",
      color: value.color || "#4c9a79",
      tags: value.tags || [],
      resourceStatus: value.resourceStatus || "unanswered",
      resourcePreparationMinutes:
        value.resourcePreparationMinutes === undefined ? 60 : value.resourcePreparationMinutes,
    })
    .returning();
  return toAccount(row);
}

export async function deleteAccount(id: string, userId?: string): Promise<boolean> {
  const rows = await drizzleDatabase()
    .delete(accounts)
    .where(and(eq(accounts.id, id), userId ? eq(accounts.userId, userId) : undefined))
    .returning({ id: accounts.id });
  return rows.length > 0;
}
