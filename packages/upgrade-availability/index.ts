export type DisplayOptions = {
  goblinResearcher: boolean;
  goblinBuilder: boolean;
};

export type UpgradeChartInput = { finishAt: string; base?: string };
export type UpgradeTimelinePoint = { at: number; activeHome: number; activeAll: number; availableHome: number; availableAll: number };
export type CompletionBin = { start: number; end: number; home: number; all: number };

export type BuilderAvailability = {
  free: number;
  total: number;
  regularTotal?: number;
};

export type LaboratoryAvailability = {
  available: boolean;
  active?: number;
  total?: number;
};

export type AvailabilityAccount = {
  builders: BuilderAvailability;
  upgradeSlots?: {
    laboratory: LaboratoryAvailability | null;
    petHouse?: { available: boolean } | null;
    builderBase?: { builders: BuilderAvailability; laboratory: LaboratoryAvailability | null } | null;
  };
};

export type AvailabilityObservations = {
  goblinResearcher: boolean;
  goblinBuilder: boolean;
};

export type DisplayAvailability = {
  builders: BuilderAvailability;
  laboratory: LaboratoryAvailability | null;
};

export type AvailabilitySummary = {
  homeVillage: number;
  builderBase: number;
};
export type AvailabilityFilter = "all" | "home" | "any";

export const defaultDisplayOptions: DisplayOptions = {
  goblinResearcher: true,
  goblinBuilder: true,
};

export function observeAvailability(accounts: AvailabilityAccount[]): AvailabilityObservations {
  return {
    goblinResearcher: accounts.some((account) => (account.upgradeSlots?.laboratory?.active || 0) > 1),
    goblinBuilder: accounts.some((account) => account.builders.total > (account.builders.regularTotal ?? account.builders.total)),
  };
}

export function applyDisplayOptions(account: AvailabilityAccount, observations: AvailabilityObservations, options: DisplayOptions): DisplayAvailability {
  const regularBuilders = account.builders.regularTotal ?? account.builders.total;
  const activeBuilders = Math.max(0, account.builders.total - account.builders.free);
  const inferGoblinBuilder = options.goblinBuilder && observations.goblinBuilder
    && regularBuilders >= 5 && activeBuilders >= regularBuilders;
  const builderTotal = inferGoblinBuilder ? Math.max(account.builders.total, regularBuilders + 1) : account.builders.total;
  const builders = inferGoblinBuilder
    ? { ...account.builders, total: builderTotal, free: Math.max(0, builderTotal - activeBuilders) }
    : account.builders;

  const laboratory = account.upgradeSlots?.laboratory || null;
  const inferGoblinResearcher = options.goblinResearcher && observations.goblinResearcher
    && (laboratory?.active || 0) === 1;

  return {
    builders,
    laboratory: laboratory && inferGoblinResearcher
      ? { ...laboratory, available: true, total: Math.max(2, laboratory.total || 1) }
      : laboratory,
  };
}

export function summarizeAvailability(accounts: AvailabilityAccount[], observations: AvailabilityObservations, options: DisplayOptions): AvailabilitySummary {
  return accounts.reduce<AvailabilitySummary>((summary, account) => {
    const displayed = applyDisplayOptions(account, observations, options);
    summary.homeVillage += displayed.builders.free
      + Number(Boolean(displayed.laboratory?.available))
      + Number(Boolean(account.upgradeSlots?.petHouse?.available));
    summary.builderBase += (account.upgradeSlots?.builderBase?.builders.free || 0)
      + Number(Boolean(account.upgradeSlots?.builderBase?.laboratory?.available));
    return summary;
  }, { homeVillage: 0, builderBase: 0 });
}

export function matchesAvailabilityFilter(account: AvailabilityAccount, filter: AvailabilityFilter, observations: AvailabilityObservations, options: DisplayOptions): boolean {
  if (filter === "all") return true;
  const displayed = applyDisplayOptions(account, observations, options);
  const home = displayed.builders.free > 0 || Boolean(displayed.laboratory?.available) || Boolean(account.upgradeSlots?.petHouse?.available);
  if (filter === "home") return home;
  return home || Boolean(account.upgradeSlots?.builderBase?.builders.free) || Boolean(account.upgradeSlots?.builderBase?.laboratory?.available);
}

export function buildUpgradeChartData(upgrades: UpgradeChartInput[], idleHome: number, idleBuilder: number, now: number, binCount = 8): { timeline: UpgradeTimelinePoint[]; bins: CompletionBin[] } {
  const isHome = (upgrade: UpgradeChartInput) => upgrade.base !== "builder";
  const active = upgrades.filter((upgrade) => Number.isFinite(new Date(upgrade.finishAt).getTime()) && new Date(upgrade.finishAt).getTime() > now);
  const finishTimes = [...new Set(active.map((upgrade) => new Date(upgrade.finishAt).getTime()))].sort((a, b) => a - b);
  const timeline = [now, ...finishTimes].map((at) => {
    const completed = active.filter((upgrade) => new Date(upgrade.finishAt).getTime() <= at);
    const activeAt = active.filter((upgrade) => new Date(upgrade.finishAt).getTime() > at);
    const completedHome = completed.filter(isHome).length;
    return { at, activeHome: activeAt.filter(isHome).length, activeAll: activeAt.length, availableHome: idleHome + completedHome, availableAll: idleHome + idleBuilder + completed.length };
  });
  const horizon = finishTimes.at(-1) ?? now + 60 * 60_000;
  const width = Math.max(1, horizon - now);
  const count = Math.max(1, binCount);
  const bins = Array.from({ length: count }, (_, index) => {
    const start = now + width * index / count;
    const end = now + width * (index + 1) / count;
    const entries = active.filter((upgrade) => { const finish = new Date(upgrade.finishAt).getTime(); return finish > start && finish <= end; });
    return { start, end, home: entries.filter(isHome).length, all: entries.length };
  });
  return { timeline, bins };
}
