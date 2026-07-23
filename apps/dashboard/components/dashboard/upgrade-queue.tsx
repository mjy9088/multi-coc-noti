"use client";

import { EmptyState } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { DashboardCard, DashboardSection } from "./dashboard-layout";
import type { Upgrade, Village } from "./dashboard-model";

export function UpgradeQueue({
  upgrades,
  clockNow,
  formatDuration,
  formatQueueDate,
}: {
  upgrades: Array<{ account: Village; upgrade: Upgrade }>;
  clockNow: number;
  formatDuration: (value: string, reference: number) => string;
  formatQueueDate: (value: string) => string;
}) {
  const t = useTranslations("Dashboard");
  const labels = { building: t("building"), hero: t("hero"), pet: t("pet"), research: t("research") };
  return (
    <DashboardSection kind="queue" id="upgrade-queue" eyebrow="UPGRADE QUEUE" title={t("queue")} actions={t("soonest")}>
      <div className="queue">
        {upgrades.map(({ account, upgrade }, index) => {
          const urgency = new Date(upgrade.finishAt).getTime() - clockNow < 6 * 3600_000;
          return (
            <DashboardCard kind="upgrade" priority={urgency ? "urgent" : "normal"} key={`${account.id}-${upgrade.id}`}>
              <div className={`upgrade-icon ${upgrade.type}`}>
                {upgrade.type === "research" ? "⌁" : upgrade.type === "hero" ? "♛" : "◆"}
              </div>
              <div className="upgrade-info">
                <span>
                  {account.name} · {labels[upgrade.type]}
                </span>
                <h3>{upgrade.name}</h3>
                <p>
                  {t("level")} {upgrade.level} → <b>{upgrade.nextLevel || upgrade.level + 1}</b>
                </p>
              </div>
              <div className="timeline">
                <div>
                  <span>{urgency ? t("soon") : t("remaining")}</span>
                  <strong>{formatDuration(upgrade.finishAt, clockNow)}</strong>
                </div>
                <em>
                  <i style={{ width: `${Math.max(12, 88 - index * 13)}%` }} />
                </em>
              </div>
              <time>{formatQueueDate(upgrade.finishAt)}</time>
            </DashboardCard>
          );
        })}
        {!upgrades.length && <EmptyState title={t("empty")} />}
      </div>
    </DashboardSection>
  );
}
