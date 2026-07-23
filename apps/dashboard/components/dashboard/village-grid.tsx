"use client";

import { Badge, EmptyState } from "@multi-coc/ui";
import type { DisplayOptions } from "@multi-coc/upgrade-availability";
import { applyDisplayOptions, type observeAvailability } from "@multi-coc/upgrade-availability";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import UpgradeAvailabilityPanel from "../upgrade-availability-panel";
import { DashboardCard, DashboardSection } from "./dashboard-layout";
import type { Village } from "./dashboard-model";

type AvailabilityObservations = ReturnType<typeof observeAvailability>;

function Shield({ level, color }: { level: number; color: string }) {
  return (
    <div className="shield" style={{ "--shield": color } as CSSProperties}>
      <span>TH</span>
      {level}
    </div>
  );
}

export function VillageGrid({
  accounts,
  availabilityObservations,
  displayOptions,
  clockNow,
  formatRelative,
}: {
  accounts: Village[];
  availabilityObservations: AvailabilityObservations;
  displayOptions: DisplayOptions;
  clockNow: number;
  formatRelative: (value: string, reference: number) => string;
}) {
  const t = useTranslations("Dashboard");
  return (
    <DashboardSection kind="villages" header="hidden" id="village-list">
      <div className="village-grid">
        {accounts.map((account) => {
          const { builders, laboratory } = applyDisplayOptions(account, availabilityObservations, displayOptions);
          const upgradeSlots = account.upgradeSlots ? { ...account.upgradeSlots, laboratory } : undefined;
          return (
            <Link
              className="village-card-link"
              key={account.id}
              href={`/villages/${encodeURIComponent(account.id)}`}
              style={{ "--accent": account.color } as CSSProperties}
              aria-label={t("openVillage", { name: account.name })}
            >
              <DashboardCard kind="village">
                <div className="card-head">
                  <Shield level={account.townHall} color={account.color} />
                  <div>
                    <h2>{account.name}</h2>
                    <p>
                      {account.tag} · {t("level")} {account.level}
                    </p>
                  </div>
                  {account.refreshRequired && <Badge tone="warning">{t("refreshRequired")}</Badge>}
                </div>
                {!!account.tags?.length && (
                  <div className="account-tag-list">
                    {account.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                <UpgradeAvailabilityPanel builders={builders} upgradeSlots={upgradeSlots} />
                <div className="card-foot">
                  <span>
                    {t("inProgress")} <b>{account.upgrades.length}</b>
                  </span>
                  <span>
                    {t("updated")} {formatRelative(account.lastSeen, clockNow)}
                  </span>
                </div>
              </DashboardCard>
            </Link>
          );
        })}
        {!accounts.length && <EmptyState title={t("noMatches")} />}
      </div>
    </DashboardSection>
  );
}
