"use client";

import { useTranslations } from "next-intl";
import type { Dispatch, SetStateAction } from "react";
import { SettingsSurface } from "../settings-layout";
import type { Account, Upgrade, UpgradeAlertDraft } from "../settings-model";
import { UpgradeAlertItem } from "./upgrade-alert-item";

export function UpgradeAlertsTab({
  accounts,
  upgrades,
  drafts,
  setDrafts,
  savingUpgradeId,
  clockNow,
  onOpenVillage,
  onSave,
}: {
  accounts: Account[];
  upgrades: Upgrade[];
  drafts: Record<string, UpgradeAlertDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, UpgradeAlertDraft>>>;
  savingUpgradeId: string | null;
  clockNow: number;
  onOpenVillage: (account: Account | undefined) => void;
  onSave: (upgrade: Upgrade) => void;
}) {
  const t = useTranslations("Settings");
  const activeUpgrades = upgrades.filter((item) => item.status === "active");

  return (
    <SettingsSurface kind="upgrades">
      <h2>{t("upgradeAlertsTitle")}</h2>
      <p>{t("upgradeAlertsHelp")}</p>
      <div className="settings-upgrade-list">
        {activeUpgrades.length ? (
          activeUpgrades.map((upgrade) => {
            const account = accounts.find((candidate) => candidate.id === upgrade.accountId);
            const draft = drafts[upgrade.id] || { mode: "inherit", minutes: 60 };
            return (
              <UpgradeAlertItem
                key={upgrade.id}
                account={account}
                upgrade={upgrade}
                draft={draft}
                saving={savingUpgradeId === upgrade.id}
                clockNow={clockNow}
                onDraftChange={(nextDraft) => setDrafts((current) => ({ ...current, [upgrade.id]: nextDraft }))}
                onOpenVillage={() => onOpenVillage(account)}
                onSave={() => onSave(upgrade)}
              />
            );
          })
        ) : (
          <p>{t("noTrackedUpgrades")}</p>
        )}
      </div>
    </SettingsSurface>
  );
}
