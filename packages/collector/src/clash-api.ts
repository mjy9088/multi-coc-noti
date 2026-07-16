import type { Account, VillageSnapshot } from "@multi-coc/shared";

const DEFAULT_API_BASE = "https://api.clashofclans.com/v1";
export type PlayerProfile = { name: string; tag: string; townHall: number; level: number };

export function clashApiToken(account: Partial<Pick<Account, "clashApiToken">>, env: NodeJS.ProcessEnv = process.env): string {
  return account.clashApiToken || env.CLASH_OF_CLANS_API_TOKEN || "";
}

export function mapPlayerProfile(player: Record<string, unknown>): PlayerProfile {
  return {
    name: String(player.name || ""),
    tag: String(player.tag || ""),
    townHall: Number(player.townHallLevel || 0),
    level: Number(player.expLevel || 0),
  };
}

export async function fetchPlayerProfile(account: Pick<Account, "playerTag"> & Partial<Pick<Account, "clashApiToken">>, { env = process.env, fetchImpl = fetch }: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}): Promise<PlayerProfile | null> {
  const token = clashApiToken(account, env);
  if (!token || !account.playerTag) return null;
  const apiBase = (env.CLASH_OF_CLANS_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const response = await fetchImpl(`${apiBase}/players/${encodeURIComponent(account.playerTag)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    let detail = "";
    try { detail = String((await response.json() as { message?: string }).message || ""); } catch { /* response body is optional */ }
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return mapPlayerProfile(await response.json() as Record<string, unknown>);
}

export function mergeOfficialProfile<T extends Partial<VillageSnapshot> & Pick<VillageSnapshot, "name" | "dataSource">>(snapshot: T, profile: Partial<PlayerProfile> | null | undefined): T {
  if (!profile || snapshot.dataSource === "example") return snapshot;
  return {
    ...snapshot,
    name: profile.name || snapshot.name,
    tag: profile.tag || snapshot.tag,
    townHall: profile.townHall || snapshot.townHall,
    level: profile.level || snapshot.level,
  } as T;
}
