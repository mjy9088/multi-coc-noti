"use client";

import { Badge, DataListItem } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import type { HistoryVillage, SyncEntry } from "./history-model";

export function SyncHistoryItem({
  sync,
  village,
  formatDateTime,
}: {
  sync: SyncEntry;
  village: HistoryVillage | undefined;
  formatDateTime: (value: string) => string;
}) {
  const t = useTranslations("History");
  return (
    <DataListItem
      className="history-card"
      style={{ "--accent": village?.color || "var(--ui-color-accent)" } as CSSProperties}
    >
      <i className="history-type sync" />
      <div>
        <span>{village?.name || sync.playerTag}</span>
        <h2>{t("syncSummary", { townHall: sync.townHall, upgrades: sync.upgrades })}</h2>
        <p>
          {t("syncDetails", {
            home: sync.homeUpgrades,
            builder: sync.builderUpgrades,
            free: sync.builders.free,
            total: sync.builders.total,
          })}
        </p>
        {sync.unknownDataIds > 0 && <small>{t("unknownData", { count: sync.unknownDataIds })}</small>}
      </div>
      <div className="history-result">
        <Badge tone="success">{t("synced")}</Badge>
        <time>{formatDateTime(sync.importedAt)}</time>
        <small>{t("exportedAt", { date: formatDateTime(sync.exportedAt) })}</small>
      </div>
    </DataListItem>
  );
}
