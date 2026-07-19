import { eq } from "drizzle-orm";
import { drizzleDatabase } from "../client.ts";
import { userDashboardSettings } from "../schema.ts";

export async function getDashboardSettings(userId: string): Promise<{ groupOrder: string[] }> {
  const [row] = await drizzleDatabase()
    .select({ groupOrder: userDashboardSettings.groupOrder })
    .from(userDashboardSettings)
    .where(eq(userDashboardSettings.userId, userId));
  return { groupOrder: row?.groupOrder || [] };
}

export async function updateDashboardSettings(userId: string, groupOrder: string[]): Promise<{ groupOrder: string[] }> {
  const [row] = await drizzleDatabase()
    .insert(userDashboardSettings)
    .values({ userId, groupOrder })
    .onConflictDoUpdate({
      target: userDashboardSettings.userId,
      set: { groupOrder, updatedAt: new Date() },
    })
    .returning({ groupOrder: userDashboardSettings.groupOrder });
  return row;
}
