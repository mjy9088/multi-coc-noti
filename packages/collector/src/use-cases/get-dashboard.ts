import { getDashboardSettings, listLatestVillageExports, listTrackedUpgrades } from "@multi-coc/database";
import type { VillageSnapshot } from "@multi-coc/shared";
import { isUpgradeActive, isVillageRefreshRequired } from "@multi-coc/shared";
import { parseVillageDetails } from "@multi-coc/village-export";
import { mergeOfficialProfile } from "../services/clash-api.ts";
import type { CollectorState } from "../services/collector-state.ts";

export async function getDashboard(
  state: CollectorState,
): Promise<{ generatedAt: string; accounts: VillageSnapshot[]; groupOrder: string[] }> {
  const tracked = await listTrackedUpgrades();
  const exports = new Map((await listLatestVillageExports()).map((item) => [item.accountId, item]));
  const result = await Promise.all(
    state.accounts.map(async (account) => {
      const latestExport = exports.get(account.id);
      const villageExport = latestExport?.normalized;
      const accountUpgrades = tracked.filter((upgrade) => upgrade.accountId === account.id);
      const latest: VillageSnapshot = {
        id: account.id,
        name: account.label,
        tag: account.playerTag,
        townHall: 0,
        level: 0,
        color: account.color,
        tags: account.tags,
        online: false,
        lastSeen: new Date().toISOString(),
        builders: { free: 0, total: 0 },
        resources: null,
        upgrades: [],
      };
      if (villageExport) {
        const knownHomeBuilderTasks = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "home" && (upgrade.type === "building" || upgrade.type === "hero"),
        ).length;
        const activeHomeBuilderTasks = villageExport.upgrades.filter(
          (upgrade) =>
            upgrade.base === "home" &&
            (upgrade.type === "building" || upgrade.type === "hero") &&
            isUpgradeActive(upgrade),
        ).length;
        const builders = {
          total: Math.max(villageExport.builders.total, knownHomeBuilderTasks),
          free: Math.max(0, Math.max(villageExport.builders.total, knownHomeBuilderTasks) - activeHomeBuilderTasks),
          regularTotal: villageExport.builders.regularTotal ?? villageExport.builders.total,
        };
        const builderBase = villageExport.upgradeSlots?.builderBase;
        const laboratory = villageExport.upgradeSlots?.laboratory;
        const knownHomeResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "home" && upgrade.type === "research",
        ).length;
        const activeHomeResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "home" && upgrade.type === "research" && isUpgradeActive(upgrade),
        ).length;
        const homeLaboratoryBusy = villageExport.upgrades.some(
          (upgrade) => upgrade.base === "home" && upgrade.dataId === 1000007 && isUpgradeActive(upgrade),
        );
        const knownBuilderBaseTasks = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type !== "research",
        ).length;
        const activeBuilderBaseTasks = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type !== "research" && isUpgradeActive(upgrade),
        ).length;
        const builderLaboratory = builderBase?.laboratory;
        const knownBuilderResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type === "research",
        ).length;
        const activeBuilderResearch = villageExport.upgrades.filter(
          (upgrade) => upgrade.base === "builder" && upgrade.type === "research" && isUpgradeActive(upgrade),
        ).length;
        const builderLaboratoryBusy = villageExport.upgrades.some(
          (upgrade) => upgrade.base === "builder" && upgrade.dataId === 1000046 && isUpgradeActive(upgrade),
        );
        const upgradeSlots = villageExport.upgradeSlots
          ? {
              ...villageExport.upgradeSlots,
              laboratory: laboratory
                ? {
                    ...laboratory,
                    available: activeHomeResearch === 0 && !homeLaboratoryBusy,
                    active: activeHomeResearch,
                    total: Math.max(laboratory.total || 1, knownHomeResearch),
                  }
                : null,
              builderBase: builderBase
                ? {
                    ...builderBase,
                    builders: {
                      total: Math.max(builderBase.builders.total, knownBuilderBaseTasks),
                      free: Math.max(
                        0,
                        Math.max(builderBase.builders.total, knownBuilderBaseTasks) - activeBuilderBaseTasks,
                      ),
                    },
                    laboratory: builderLaboratory
                      ? {
                          ...builderLaboratory,
                          available: activeBuilderResearch === 0 && !builderLaboratoryBusy,
                          active: activeBuilderResearch,
                          total: Math.max(builderLaboratory.total || 1, knownBuilderResearch),
                        }
                      : null,
                  }
                : null,
            }
          : undefined;
        Object.assign(latest, {
          tag: villageExport.tag,
          townHall: villageExport.townHall || latest.townHall,
          builders,
          upgradeSlots,
          ...parseVillageDetails(latestExport?.raw, Math.floor(new Date(latestExport.exportedAt).getTime() / 1000)),
          ...(villageExport.cooldowns ? { cooldowns: villageExport.cooldowns } : {}),
          ...(villageExport.helpers ? { helpers: villageExport.helpers } : {}),
          ...(villageExport.heroEquipment ? { heroEquipment: villageExport.heroEquipment } : {}),
          upgrades: villageExport.upgrades,
          lastSeen: latestExport.exportedAt,
          online: true,
        });
      }
      const upgrades = accountUpgrades.filter((upgrade) => isUpgradeActive(upgrade));
      const refreshCompletion = accountUpgrades
        .filter((upgrade) => isVillageRefreshRequired(latest.lastSeen, upgrade.finishAt))
        .sort((a, b) => +new Date(b.finishAt) - +new Date(a.finishAt))[0];
      return mergeOfficialProfile(
        {
          ...latest,
          id: account.id,
          color: account.color,
          tags: account.tags,
          upgrades,
          refreshRequired: Boolean(refreshCompletion),
          refreshCompletedAt: refreshCompletion?.finishAt || null,
          online: Boolean(villageExport),
        },
        state.officialProfiles.get(account.id),
      );
    }),
  );
  const { groupOrder } = await getDashboardSettings();
  return { generatedAt: new Date().toISOString(), accounts: result, groupOrder };
}
