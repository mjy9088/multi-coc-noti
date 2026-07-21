"use client";

import "./village-detail.css";

import {
  Button,
  Card,
  DataList,
  DataListItem,
  EmptyState,
  EntityHeader,
  EntityHeaderActions,
  EntityHeaderIdentity,
  EntityHeaderMeta,
  EntityHeaderTitle,
  Stat,
  StatGrid,
} from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import UpgradeAvailabilityPanel from "../../app/upgrade-availability-panel";

type VillagePanelKind = "availability" | "metrics" | "cooldown" | "helpers" | "equipment" | "upgrades";

const villagePanelRules: Record<VillagePanelKind, string> = {
  availability: "village-detail-card",
  metrics: "village-detail-card",
  cooldown: "village-detail-card cooldown-card",
  helpers: "village-detail-card",
  equipment: "village-detail-card equipment-card",
  upgrades: "village-detail-card village-upgrades",
};

function VillagePanel({ kind, ...props }: Omit<ComponentProps<typeof Card>, "className"> & { kind: VillagePanelKind }) {
  return <Card {...props} className={villagePanelRules[kind]} />;
}

type DetailVillage = {
  id: string;
  name: string;
  tag: string;
  townHall: number;
  level: number;
  color: string;
  lastSeen: string;
  builders: { free: number; total: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: {
      builders: { free: number; total: number };
      laboratory: { available: boolean; active?: number; total?: number } | null;
    } | null;
  };
  cooldowns?: { clockTower: string | null; helpers: Array<{ dataId: number; availableAt: string }> };
  helpers?: Array<{ dataId: number; name: string; level: number; availableAt: string | null }>;
  heroEquipment?: Array<{ dataId: number; name: string; level: number }>;
  officialStats?: {
    trophies: number;
    bestTrophies: number;
    league: string | null;
    warStars: number;
    donations: number;
    donationsReceived: number;
    capitalContributions: number;
  };
  upgrades: Array<{
    id: string;
    name: string;
    level: number;
    nextLevel?: number;
    type: string;
    base?: string;
    finishAt: string;
  }>;
};

export default function VillageDetail({
  village,
  now,
  formatDuration,
  formatDateTime,
  onBack,
  onHistory,
  onSettings,
}: {
  village: DetailVillage;
  now: number;
  formatDuration: (value: string, reference: number) => string;
  formatDateTime: (value: string) => string;
  onBack: () => void;
  onHistory: () => void;
  onSettings: () => void;
}) {
  const t = useTranslations("Dashboard");
  const cooldown = (availableAt: string) => (
    <>
      <strong>{new Date(availableAt).getTime() > now ? formatDuration(availableAt, now) : t("availableNow")}</strong>
      <small>{formatDateTime(availableAt)}</small>
    </>
  );
  const homeUpgrades = village.upgrades.filter((item) => item.base !== "builder");
  const builderUpgrades = village.upgrades.filter((item) => item.base === "builder");
  const typeCount = (type: string) => village.upgrades.filter((item) => item.type === type).length;
  const stats = village.officialStats;
  return (
    <section className="village-detail shell">
      <div className="village-detail-actions">
        <Button tone="secondary" onClick={onBack}>
          ← {t("backToDashboard")}
        </Button>
        <span>
          <Button tone="secondary" onClick={onHistory}>
            {t("history")}
          </Button>
          <Button onClick={onSettings}>{t("villageSettings")}</Button>
        </span>
      </div>
      <EntityHeader className="village-detail-header" style={{ "--accent": village.color } as React.CSSProperties}>
        <EntityHeaderIdentity>
          <p className="eyebrow">VILLAGE</p>
          <EntityHeaderTitle>{village.name}</EntityHeaderTitle>
          <EntityHeaderMeta>
            {village.tag} · TH {village.townHall} · {t("level")} {village.level}
          </EntityHeaderMeta>
        </EntityHeaderIdentity>
        <EntityHeaderActions>
          {t("updated")} {formatDateTime(village.lastSeen)}
        </EntityHeaderActions>
      </EntityHeader>
      <div className="village-detail-grid">
        <VillagePanel kind="availability">
          <h2>{t("upgradeAvailability")}</h2>
          <UpgradeAvailabilityPanel builders={village.builders} upgradeSlots={village.upgradeSlots} />
        </VillagePanel>
        <VillagePanel kind="metrics">
          <h2>{t("upgradeSummary")}</h2>
          <StatGrid className="metric-grid">
            <Stat label={t("homeVillage")} value={homeUpgrades.length} />
            <Stat label={t("builderBase")} value={builderUpgrades.length} />
            <Stat label={t("building")} value={typeCount("building")} />
            <Stat label={t("hero")} value={typeCount("hero")} />
            <Stat label={t("research")} value={typeCount("research")} />
            <Stat label={t("pet")} value={typeCount("pet")} />
          </StatGrid>
        </VillagePanel>
        {stats && (
          <VillagePanel kind="metrics">
            <h2>{t("playerStats")}</h2>
            <StatGrid className="metric-grid">
              {stats.league && <Stat className="metric-text" label={t("league")} value={stats.league} />}
              <Stat label={t("trophies")} value={stats.trophies.toLocaleString()} />
              <Stat label={t("bestTrophies")} value={stats.bestTrophies.toLocaleString()} />
              <Stat label={t("warStars")} value={stats.warStars.toLocaleString()} />
              <Stat label={t("donations")} value={stats.donations.toLocaleString()} />
              <Stat label={t("donationsReceived")} value={stats.donationsReceived.toLocaleString()} />
              <Stat label={t("capitalContributions")} value={stats.capitalContributions.toLocaleString()} />
            </StatGrid>
          </VillagePanel>
        )}
        {village.cooldowns?.clockTower && (
          <VillagePanel kind="cooldown">
            <h2>{t("cooldowns")}</h2>
            <div className="cooldown-grid">
              {village.cooldowns?.clockTower && (
                <div>
                  <span>{t("clockTower")}</span>
                  {cooldown(village.cooldowns.clockTower)}
                </div>
              )}
            </div>
          </VillagePanel>
        )}
        {!!village.helpers?.length && (
          <VillagePanel kind="helpers">
            <h2>{t("villageHelpers")}</h2>
            <div className="detail-item-grid">
              {village.helpers.map((helper) => (
                <div key={helper.dataId}>
                  <span className="detail-name">
                    <b>{helper.name}</b>
                    <small>
                      {t("level")} {helper.level}
                    </small>
                  </span>
                  {helper.availableAt && <span className="detail-timer">{cooldown(helper.availableAt)}</span>}
                </div>
              ))}
            </div>
          </VillagePanel>
        )}
      </div>
      {!!village.heroEquipment?.length && (
        <VillagePanel kind="equipment">
          <h2>{t("heroEquipment")}</h2>
          <div className="equipment-grid">
            {village.heroEquipment.map((item) => (
              <div key={item.dataId}>
                <span>{item.name}</span>
                <strong>
                  {t("level")} {item.level}
                </strong>
              </div>
            ))}
          </div>
        </VillagePanel>
      )}
      <VillagePanel kind="upgrades">
        <h2>{t("activeVillageUpgrades")}</h2>
        {village.upgrades.length ? (
          <DataList>
            {village.upgrades.map((upgrade) => (
              <DataListItem key={upgrade.id}>
                <span>
                  <b>{upgrade.name}</b>
                  <small>
                    {upgrade.base === "builder" ? t("builderBase") : t("homeVillage")} · {t("level")} {upgrade.level} →{" "}
                    {upgrade.nextLevel || upgrade.level + 1}
                  </small>
                </span>
                <span>
                  <strong>{formatDuration(upgrade.finishAt, now)}</strong>
                  <small>{formatDateTime(upgrade.finishAt)}</small>
                </span>
              </DataListItem>
            ))}
          </DataList>
        ) : (
          <EmptyState title={t("empty")} />
        )}
      </VillagePanel>
    </section>
  );
}
