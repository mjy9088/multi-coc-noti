"use client";

import { Badge, DataListItem } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type { HistoryUpgrade, HistoryVillage } from "./history-model";

export function UpgradeHistoryItem({
  upgrade,
  village,
  formatDateTime,
}: {
  upgrade: HistoryUpgrade;
  village: HistoryVillage | undefined;
  formatDateTime: (value: string) => string;
}) {
  const t = useTranslations("History");
  const labels = {
    building: t("building"),
    hero: t("hero"),
    pet: t("pet"),
    research: t("research"),
  };
  return (
    <DataListItem
      className="history-card"
      style={{ "--accent": village?.color || "var(--ui-color-accent)" } as CSSProperties}
    >
      <i className={`history-type ${upgrade.type}`} />
      <div>
        <span>
          {village?.name || upgrade.accountId} · {labels[upgrade.type]}
        </span>
        <h2>{upgrade.name}</h2>
        <p>
          {upgrade.base === "builder" ? t("builderBase") : t("home")} ·{" "}
          {t("level", { from: upgrade.level, to: upgrade.nextLevel })}
        </p>
      </div>
      <div className="history-result">
        <Badge tone={upgrade.active ? "accent" : "neutral"}>{t(upgrade.active ? "active" : "inactive")}</Badge>
        <time>{formatDateTime(upgrade.finishAt)}</time>
      </div>
    </DataListItem>
  );
}
