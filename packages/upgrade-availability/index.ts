export type DisplayOptions = {
  goblinResearcher: boolean;
  goblinBuilder: boolean;
};

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
