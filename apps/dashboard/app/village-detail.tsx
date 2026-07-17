"use client";

import { useTranslations } from "next-intl";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";

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
        <button className="secondary" onClick={onBack}>
          ← {t("backToDashboard")}
        </button>
        <span>
          <button className="secondary" onClick={onHistory}>
            {t("history")}
          </button>
          <button onClick={onSettings}>{t("villageSettings")}</button>
        </span>
      </div>
      <header className="village-detail-header" style={{ "--accent": village.color } as React.CSSProperties}>
        <div>
          <p className="eyebrow">VILLAGE</p>
          <h1>{village.name}</h1>
          <p>
            {village.tag} · TH {village.townHall} · {t("level")} {village.level}
          </p>
        </div>
        <span>
          {t("updated")} {formatDateTime(village.lastSeen)}
        </span>
      </header>
      <div className="village-detail-grid">
        <article className="village-detail-card">
          <h2>{t("upgradeAvailability")}</h2>
          <UpgradeAvailabilityPanel builders={village.builders} upgradeSlots={village.upgradeSlots} />
        </article>
        <article className="village-detail-card">
          <h2>{t("upgradeSummary")}</h2>
          <div className="metric-grid">
            <div>
              <span>{t("homeVillage")}</span>
              <strong>{homeUpgrades.length}</strong>
            </div>
            <div>
              <span>{t("builderBase")}</span>
              <strong>{builderUpgrades.length}</strong>
            </div>
            <div>
              <span>{t("building")}</span>
              <strong>{typeCount("building")}</strong>
            </div>
            <div>
              <span>{t("hero")}</span>
              <strong>{typeCount("hero")}</strong>
            </div>
            <div>
              <span>{t("research")}</span>
              <strong>{typeCount("research")}</strong>
            </div>
            <div>
              <span>{t("pet")}</span>
              <strong>{typeCount("pet")}</strong>
            </div>
          </div>
        </article>
        {stats && (
          <article className="village-detail-card">
            <h2>{t("playerStats")}</h2>
            <div className="metric-grid">
              {stats.league && (
                <div>
                  <span>{t("league")}</span>
                  <strong className="metric-text">{stats.league}</strong>
                </div>
              )}
              <div>
                <span>{t("trophies")}</span>
                <strong>{stats.trophies.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t("bestTrophies")}</span>
                <strong>{stats.bestTrophies.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t("warStars")}</span>
                <strong>{stats.warStars.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t("donations")}</span>
                <strong>{stats.donations.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t("donationsReceived")}</span>
                <strong>{stats.donationsReceived.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t("capitalContributions")}</span>
                <strong>{stats.capitalContributions.toLocaleString()}</strong>
              </div>
            </div>
          </article>
        )}
        {village.cooldowns?.clockTower && (
          <article className="village-detail-card cooldown-card">
            <h2>{t("cooldowns")}</h2>
            <div className="cooldown-grid">
              {village.cooldowns?.clockTower && (
                <div>
                  <span>{t("clockTower")}</span>
                  {cooldown(village.cooldowns.clockTower)}
                </div>
              )}
            </div>
          </article>
        )}
        {!!village.helpers?.length && (
          <article className="village-detail-card">
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
          </article>
        )}
      </div>
      {!!village.heroEquipment?.length && (
        <article className="village-detail-card equipment-card">
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
        </article>
      )}
      <article className="village-detail-card village-upgrades">
        <h2>{t("activeVillageUpgrades")}</h2>
        {village.upgrades.length ? (
          village.upgrades.map((upgrade) => (
            <div key={upgrade.id}>
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
            </div>
          ))
        ) : (
          <p>{t("empty")}</p>
        )}
      </article>
    </section>
  );
}
