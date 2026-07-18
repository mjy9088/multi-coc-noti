import { eq } from "drizzle-orm";
import { drizzleDatabase } from "../client.ts";
import { dashboardSettings } from "../schema.ts";

export async function getDashboardSettings(): Promise<{ groupOrder: string[] }> {
  const [row] = await drizzleDatabase()
    .select({ groupOrder: dashboardSettings.groupOrder })
    .from(dashboardSettings)
    .where(eq(dashboardSettings.singleton, true));
  return { groupOrder: row?.groupOrder || [] };
}

export async function updateDashboardSettings(groupOrder: string[]): Promise<{ groupOrder: string[] }> {
  const [row] = await drizzleDatabase()
    .insert(dashboardSettings)
    .values({ singleton: true, groupOrder })
    .onConflictDoUpdate({
      target: dashboardSettings.singleton,
      set: { groupOrder, updatedAt: new Date() },
    })
    .returning({ groupOrder: dashboardSettings.groupOrder });
  return row;
}
