import type { Account, OfficialPlayerStats, VillageSnapshot } from "@multi-coc/shared";

const DEFAULT_API_BASE = "https://api.clashofclans.com/v1";
export type PlayerProfile = { name: string; tag: string; townHall: number; level: number; stats: OfficialPlayerStats };

export function mapPlayerProfile(player: Record<string, unknown>): PlayerProfile {
  const league = player.league && typeof player.league === "object" ? (player.league as Record<string, unknown>) : null;
  return {
    name: String(player.name || ""),
    tag: String(player.tag || ""),
    townHall: Number(player.townHallLevel || 0),
    level: Number(player.expLevel || 0),
    stats: {
      trophies: Number(player.trophies || 0),
      bestTrophies: Number(player.bestTrophies || 0),
      league: league ? String(league.name || "") || null : null,
      warStars: Number(player.warStars || 0),
      donations: Number(player.donations || 0),
      donationsReceived: Number(player.donationsReceived || 0),
      capitalContributions: Number(player.clanCapitalContributions || 0),
    },
  };
}

export async function fetchPlayerProfile(
  account: Pick<Account, "playerTag">,
  { env = process.env, fetchImpl = fetch }: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<PlayerProfile | null> {
  const token = env.CLASH_OF_CLANS_API_TOKEN || "";
  if (!token || !account.playerTag) return null;
  const apiBase = (env.CLASH_OF_CLANS_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const response = await fetchImpl(`${apiBase}/players/${encodeURIComponent(account.playerTag)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = String(((await response.json()) as { message?: string }).message || "");
    } catch {
      /* response body is optional */
    }
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return mapPlayerProfile((await response.json()) as Record<string, unknown>);
}

export function mergeOfficialProfile<T extends Partial<VillageSnapshot> & Pick<VillageSnapshot, "name" | "dataSource">>(
  snapshot: T,
  profile: Partial<PlayerProfile> | null | undefined,
): T {
  if (!profile || snapshot.dataSource === "example") return snapshot;
  return {
    ...snapshot,
    name: profile.name || snapshot.name,
    tag: profile.tag || snapshot.tag,
    townHall: profile.townHall || snapshot.townHall,
    level: profile.level || snapshot.level,
    officialStats: profile.stats || snapshot.officialStats,
  } as T;
}
