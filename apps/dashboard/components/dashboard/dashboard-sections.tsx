"use client";

import {
  Badge,
  Checkbox,
  Disclosure,
  DisclosureContent,
  DisclosureSummary,
  EmptyState,
  InputField,
  PageIntro,
  StatGrid,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
} from "@multi-coc/ui";
import type { AvailabilityFilter, DisplayOptions } from "@multi-coc/upgrade-availability";
import {
  applyDisplayOptions,
  type observeAvailability,
  type summarizeAvailability,
} from "@multi-coc/upgrade-availability";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import UpgradeAvailabilityPanel from "../../app/upgrade-availability-panel";
import { DashboardAvailabilityFilter, DashboardCard, DashboardSection, DashboardStat } from "./dashboard-layout";
import type { Upgrade, Village } from "./dashboard-model";

type AvailabilityObservations = ReturnType<typeof observeAvailability>;
type AvailabilitySummary = ReturnType<typeof summarizeAvailability>;

function Shield({ level, color }: { level: number; color: string }) {
  return (
    <div className="shield" style={{ "--shield": color } as CSSProperties}>
      <span>TH</span>
      {level}
    </div>
  );
}

export function DashboardOverview({
  query,
  setQuery,
  availabilityFilter,
  setAvailabilityFilter,
  refreshOnly,
  setRefreshOnly,
  displayOptions,
  onDisplayOptionChange,
  prioritizeAvailable,
  setPrioritizeAvailable,
  selectedTag,
  setSelectedTag,
  visibleCount,
  tagOptions,
  accountCount,
  availabilitySummary,
  next,
  clockNow,
  formatDuration,
}: {
  query: string;
  setQuery: (value: string) => void;
  availabilityFilter: AvailabilityFilter;
  setAvailabilityFilter: (value: AvailabilityFilter) => void;
  refreshOnly: boolean;
  setRefreshOnly: (value: boolean) => void;
  displayOptions: DisplayOptions;
  onDisplayOptionChange: (key: keyof DisplayOptions, value: boolean) => void;
  prioritizeAvailable: boolean;
  setPrioritizeAvailable: (value: boolean) => void;
  selectedTag: string | null;
  setSelectedTag: (value: string | null) => void;
  visibleCount: number;
  tagOptions: Array<{ key: string; label: string; count: number }>;
  accountCount: number;
  availabilitySummary: AvailabilitySummary;
  next?: Upgrade;
  clockNow: number;
  formatDuration: (value: string, reference: number) => string;
}) {
  const t = useTranslations("Dashboard");
  const clearTag = () => setSelectedTag(null);
  return (
    <section className="dashboard-hero">
      <PageIntro
        className="hero-copy"
        spacing="none"
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("subtitle")}
      />
      <div className="account-controls dashboard-filters">
        <Toolbar className="account-tools">
          <InputField
            className="dashboard-search-field"
            label={t("search")}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              clearTag();
            }}
            placeholder={t("search")}
          />
          <DashboardAvailabilityFilter
            label={t("availabilityFilter")}
            value={availabilityFilter}
            onValueChange={(value) => {
              setAvailabilityFilter(value);
              clearTag();
            }}
            options={{ all: t("statusAll"), home: t("homeSlotAvailable"), any: t("anySlotAvailable") }}
          />
          <Checkbox
            className="refresh-filter"
            label={t("refreshRequired")}
            checked={refreshOnly}
            onChange={(event) => {
              setRefreshOnly(event.target.checked);
              clearTag();
            }}
          />
          <Disclosure className="display-options">
            <DisclosureSummary>{t("displayOptions")}</DisclosureSummary>
            <DisclosureContent>
              <Checkbox
                label={t("inferGoblinResearcher")}
                checked={displayOptions.goblinResearcher}
                onChange={(event) => onDisplayOptionChange("goblinResearcher", event.target.checked)}
              />
              <Checkbox
                label={t("inferGoblinBuilder")}
                checked={displayOptions.goblinBuilder}
                onChange={(event) => onDisplayOptionChange("goblinBuilder", event.target.checked)}
              />
              <Checkbox
                label={t("prioritizeAvailable")}
                checked={prioritizeAvailable}
                onChange={(event) => setPrioritizeAvailable(event.target.checked)}
              />
            </DisclosureContent>
          </Disclosure>
        </Toolbar>
        <ToggleGroup
          className="account-tabs"
          type="single"
          aria-label={t("all")}
          value={selectedTag ?? "all"}
          onValueChange={(value) => setSelectedTag(value && value !== "all" ? value : null)}
        >
          <ToggleGroupItem value="all">
            {t("all")} <b>{visibleCount}</b>
          </ToggleGroupItem>
          {tagOptions.map((tag) => (
            <ToggleGroupItem key={tag.key} value={tag.key}>
              <span className="tag-hash">#</span>
              {tag.label} <b>{tag.count}</b>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <StatGrid className="summary-strip">
        <DashboardStat kind="accounts" label={t("accounts")} value={accountCount} />
        <DashboardStat
          kind="home-available"
          label={t("homeVillageIdle")}
          value={availabilitySummary.homeVillage}
          emphasized={availabilitySummary.homeVillage > 0}
        />
        <DashboardStat
          kind="builder-available"
          label={t("builderBaseIdle")}
          value={availabilitySummary.builderBase}
          emphasized={availabilitySummary.builderBase > 0}
        />
        <DashboardStat
          kind="earliest"
          label={t("earliest")}
          value={next ? formatDuration(next.finishAt, clockNow) : t("none")}
        />
      </StatGrid>
    </section>
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
