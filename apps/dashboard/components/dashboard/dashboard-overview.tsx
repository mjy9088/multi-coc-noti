"use client";

import {
  Checkbox,
  Disclosure,
  DisclosureContent,
  DisclosureSummary,
  InputField,
  PageIntro,
  StatGrid,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
} from "@multi-coc/ui";
import type { AvailabilityFilter, DisplayOptions, summarizeAvailability } from "@multi-coc/upgrade-availability";
import { useTranslations } from "next-intl";
import { DashboardAvailabilityFilter, DashboardStat } from "./dashboard-layout";
import type { Upgrade } from "./dashboard-model";

type AvailabilitySummary = ReturnType<typeof summarizeAvailability>;

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
