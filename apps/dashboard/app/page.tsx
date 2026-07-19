"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  StaleNotice,
  StickyStackItem,
  useStickyStack,
} from "@multi-coc/ui";
import type { AvailabilityFilter, DisplayOptions } from "@multi-coc/upgrade-availability";
import {
  applyDisplayOptions,
  buildUpgradeChartData,
  defaultDisplayOptions,
  matchesAvailabilityFilter,
  observeAvailability,
  summarizeAvailability,
} from "@multi-coc/upgrade-availability";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { dashboardQueryKey } from "./query-provider";
import { ErrorState, LoadingState } from "./request-state";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";
import UpgradeCharts from "./upgrade-charts";
import { useDashboardFormat } from "./use-dashboard-format";
import VillageDetail from "./village-detail";

type Upgrade = {
  id: string;
  name: string;
  level: number;
  nextLevel?: number;
  type: "building" | "hero" | "pet" | "research";
  base?: string;
  finishAt: string;
};

type Village = {
  id: string;
  name: string;
  tag: string;
  townHall: number;
  level: number;
  color: string;
  tags?: string[];
  online: boolean;
  refreshRequired?: boolean;
  refreshCompletedAt?: string | null;
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
  upgrades: Upgrade[];
};

type DashboardData = { generatedAt: string; accounts: Village[]; groupOrder?: string[] };
const emptyData: DashboardData = { generatedAt: new Date(0).toISOString(), accounts: [] };
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
const browserApiBase = () =>
  configuredApiBase === "same-origin" ? "" : configuredApiBase || `${location.protocol}//${location.hostname}:8787`;

function Shield({ level, color }: { level: number; color: string }) {
  return (
    <div className="shield" style={{ "--shield": color } as React.CSSProperties}>
      <span>TH</span>
      {level}
    </div>
  );
}

export default function Home({ initialVillageId = null }: { initialVillageId?: string | null } = {}) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const { formatDateTime, formatDuration, formatQueueDate, formatRelative, lowerCase } = useDashboardFormat();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(0);
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [refreshOnly, setRefreshOnly] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(defaultDisplayOptions);
  const [prioritizeAvailable, setPrioritizeAvailable] = useState(false);
  const [view] = useState<"dashboard" | "village">(initialVillageId ? "village" : "dashboard");
  const [selectedVillageId] = useState<string | null>(initialVillageId);
  const [dashboardSection, setDashboardSection] = useState<"villages" | "queue">("villages");
  const { totalHeight: stickyStackHeight } = useStickyStack();
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();
  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey(apiBase),
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/dashboard`, { cache: "no-store", credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `HTTP ${response.status}`);
      return response.json() as Promise<DashboardData>;
    },
    enabled: Boolean(apiBase || typeof window !== "undefined"),
    refetchInterval: 30_000,
  });
  const data = dashboardQuery.data || emptyData;
  const dashboardLoading = dashboardQuery.isPending;
  const dashboardError = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "";
  useEffect(() => {
    const saved = localStorage.getItem("multi-village-display-options");
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(saved) as Partial<DisplayOptions>;
        setDisplayOptions((current) => ({ ...current, ...parsed }));
      } catch {
        /* Ignore invalid browser state. */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setPrioritizeAvailable(localStorage.getItem("multi-village-prioritize-available") === "true"),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const changeDisplayOption = (key: keyof DisplayOptions, value: boolean) => {
    const next = { ...displayOptions, [key]: value };
    setDisplayOptions(next);
    localStorage.setItem("multi-village-display-options", JSON.stringify(next));
  };

  useEffect(() => {
    const initialClock = window.setTimeout(() => setClockNow(Date.now()), 0);
    const clock = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialClock);
      window.clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    if (view !== "dashboard") return;
    const updateSection = () => {
      const queue = document.getElementById("upgrade-queue");
      setDashboardSection(queue && queue.getBoundingClientRect().top <= stickyStackHeight ? "queue" : "villages");
    };
    updateSection();
    window.addEventListener("scroll", updateSection, { passive: true });
    return () => window.removeEventListener("scroll", updateSection);
  }, [stickyStackHeight, view]);

  const scrollToDashboardSection = (section: "villages" | "queue") => {
    setDashboardSection(section);
    document
      .getElementById(section === "villages" ? "village-list" : "upgrade-queue")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openVillageSettings = (accountId: string) => {
    router.push(`/settings/villages/${encodeURIComponent(accountId)}`);
  };

  const liveAccounts = useMemo(
    () =>
      data.accounts.map((account) => ({
        ...account,
        upgrades: account.upgrades.filter((upgrade) => new Date(upgrade.finishAt).getTime() > clockNow),
      })),
    [clockNow, data.accounts],
  );
  const selectedVillage = liveAccounts.find((account) => account.id === selectedVillageId);
  const availabilityObservations = useMemo(() => observeAvailability(liveAccounts), [liveAccounts]);
  const visibleAccounts = useMemo(() => {
    const needle = lowerCase(query.trim());
    return liveAccounts.filter((account) => {
      const matchesQuery =
        !needle ||
        [account.name, account.tag, account.id, ...(account.tags || [])].some((value) =>
          lowerCase(value).includes(needle),
        );
      return (
        matchesQuery &&
        matchesAvailabilityFilter(account, availabilityFilter, availabilityObservations, displayOptions) &&
        (!refreshOnly || Boolean(account.refreshRequired))
      );
    });
  }, [availabilityFilter, availabilityObservations, displayOptions, liveAccounts, lowerCase, query, refreshOnly]);
  const tagOptions = useMemo(() => {
    const options = new Map<string, { label: string; count: number }>();
    for (const account of visibleAccounts)
      for (const tag of account.tags || []) {
        const key = lowerCase(tag);
        const option = options.get(key);
        options.set(key, { label: option?.label || tag, count: (option?.count || 0) + 1 });
      }
    const order = new Map((data.groupOrder || []).map((tag, index) => [lowerCase(tag), index]));
    return [...options.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => {
        const aOrder = order.get(a.key) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = order.get(b.key) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.label.localeCompare(b.label);
      });
  }, [data.groupOrder, lowerCase, visibleAccounts]);
  const selectedTag = activeTag !== null && tagOptions.some((tag) => tag.key === activeTag) ? activeTag : null;
  const accounts = useMemo(() => {
    const filtered =
      selectedTag === null
        ? visibleAccounts
        : visibleAccounts.filter((account) => (account.tags || []).some((tag) => lowerCase(tag) === selectedTag));
    if (!prioritizeAvailable) return filtered;
    const canStartUpgrade = (account: Village) => {
      const displayed = applyDisplayOptions(account, availabilityObservations, displayOptions);
      return (
        displayed.builders.free > 0 ||
        Boolean(displayed.laboratory?.available) ||
        Boolean(account.upgradeSlots?.petHouse?.available) ||
        Boolean(account.upgradeSlots?.builderBase?.builders.free) ||
        Boolean(account.upgradeSlots?.builderBase?.laboratory?.available)
      );
    };
    return filtered
      .map((account, index) => ({ account, index, available: canStartUpgrade(account) }))
      .sort((a, b) => Number(b.available) - Number(a.available) || a.index - b.index)
      .map(({ account }) => account);
  }, [availabilityObservations, displayOptions, lowerCase, prioritizeAvailable, selectedTag, visibleAccounts]);
  const allUpgrades = useMemo(
    () =>
      accounts
        .flatMap((account) => account.upgrades.map((upgrade) => ({ account, upgrade })))
        .sort((a, b) => +new Date(a.upgrade.finishAt) - +new Date(b.upgrade.finishAt)),
    [accounts],
  );
  const availabilitySummary = summarizeAvailability(accounts, availabilityObservations, displayOptions);
  const upgradeChartData = useMemo(
    () =>
      buildUpgradeChartData(
        allUpgrades.map(({ upgrade }) => upgrade),
        availabilitySummary.homeVillage,
        availabilitySummary.builderBase,
        clockNow,
      ),
    [allUpgrades, availabilitySummary.builderBase, availabilitySummary.homeVillage, clockNow],
  );
  const next = allUpgrades[0]?.upgrade;

  return (
    <main>
      {dashboardLoading && !data.accounts.length && <LoadingState />}
      {dashboardError && !data.accounts.length && (
        <ErrorState message={dashboardError || t("dashboardLoadFailed")} retry={() => void dashboardQuery.refetch()} />
      )}
      {dashboardError && data.accounts.length > 0 && (
        <div className="shell">
          <StaleNotice onRetry={() => void dashboardQuery.refetch()} retryLabel={t("retry")}>
            {t("staleDataWarning")}
          </StaleNotice>
        </div>
      )}
      {view === "village" && selectedVillageId && selectedVillage && (
        <VillageDetail
          village={selectedVillage}
          now={clockNow}
          formatDuration={formatDuration}
          formatDateTime={formatDateTime}
          onBack={() => router.push("/")}
          onHistory={() => router.push(`/history/upgrades?village=${encodeURIComponent(selectedVillageId)}`)}
          onSettings={() => openVillageSettings(selectedVillageId)}
        />
      )}
      {view === "village" &&
        selectedVillageId &&
        data.accounts.length > 0 &&
        !liveAccounts.some((account) => account.id === selectedVillageId) && (
          <section className="village-route-missing shell">
            <h1>{t("villageNotFound")}</h1>
            <Button onClick={() => router.push("/")}>← {t("backToDashboard")}</Button>
          </section>
        )}
      <div
        className={
          view === "dashboard" &&
          (!dashboardLoading || data.accounts.length > 0) &&
          (!dashboardError || data.accounts.length > 0)
            ? "shell"
            : "shell hidden-view"
        }
      >
        <section className="dashboard-hero">
          <div className="hero-copy">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1>{t("title")}</h1>
            <p className="subcopy">{t("subtitle")}</p>
          </div>
          <div className="account-controls dashboard-filters">
            <div className="account-tools">
              <Field className="dashboard-search-field">
                <Label>{t("search")}</Label>
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveTag(null);
                  }}
                  placeholder={t("search")}
                />
              </Field>
              <Field className="dashboard-availability-field">
                <Label>{t("availabilityFilter")}</Label>
                <Select
                  value={availabilityFilter}
                  onChange={(event) => {
                    setAvailabilityFilter(event.target.value as AvailabilityFilter);
                    setActiveTag(null);
                  }}
                >
                  <option value="all">{t("statusAll")}</option>
                  <option value="home">{t("homeSlotAvailable")}</option>
                  <option value="any">{t("anySlotAvailable")}</option>
                </Select>
              </Field>
              <Checkbox
                className="refresh-filter"
                label={t("refreshRequired")}
                checked={refreshOnly}
                onChange={(event) => {
                  setRefreshOnly(event.target.checked);
                  setActiveTag(null);
                }}
              />
              <details className="display-options">
                <summary>{t("displayOptions")}</summary>
                <div>
                  <Checkbox
                    label={t("inferGoblinResearcher")}
                    checked={displayOptions.goblinResearcher}
                    onChange={(event) => changeDisplayOption("goblinResearcher", event.target.checked)}
                  />
                  <Checkbox
                    label={t("inferGoblinBuilder")}
                    checked={displayOptions.goblinBuilder}
                    onChange={(event) => changeDisplayOption("goblinBuilder", event.target.checked)}
                  />
                  <Checkbox
                    label={t("prioritizeAvailable")}
                    checked={prioritizeAvailable}
                    onChange={(event) => {
                      setPrioritizeAvailable(event.target.checked);
                      localStorage.setItem("multi-village-prioritize-available", String(event.target.checked));
                    }}
                  />
                </div>
              </details>
            </div>
            <div className="account-tabs" role="group" aria-label={t("all")}>
              <Button tone={selectedTag === null ? "primary" : "quiet"} onClick={() => setActiveTag(null)}>
                {t("all")} <b>{visibleAccounts.length}</b>
              </Button>
              {tagOptions.map((tag) => (
                <Button
                  key={tag.key}
                  tone={selectedTag === tag.key ? "primary" : "quiet"}
                  onClick={() => setActiveTag(tag.key)}
                >
                  <span className="tag-hash">#</span>
                  {tag.label} <b>{tag.count}</b>
                </Button>
              ))}
            </div>
          </div>
          <Card className="summary-strip">
            <div>
              <span>{t("accounts")}</span>
              <strong>{accounts.length}</strong>
            </div>
            <div>
              <span>{t("homeVillageIdle")}</span>
              <strong className={availabilitySummary.homeVillage ? "green" : ""}>
                {availabilitySummary.homeVillage}
              </strong>
            </div>
            <div className="builder-base-summary">
              <span>{t("builderBaseIdle")}</span>
              <strong className={availabilitySummary.builderBase ? "green" : ""}>
                {availabilitySummary.builderBase}
              </strong>
            </div>
            <div>
              <span>{t("earliest")}</span>
              <strong className="small">{next ? formatDuration(next.finishAt, clockNow) : t("none")}</strong>
            </div>
          </Card>
        </section>

        <UpgradeCharts
          bins={upgradeChartData.bins}
          timeline={upgradeChartData.timeline}
          formatTime={(value) => formatQueueDate(new Date(value).toISOString())}
          labels={{
            title: t("upgradeOutlook"),
            description: t("upgradeOutlookHelp"),
            completions: t("completionDistribution"),
            active: t("activeUpgradeTrend"),
            available: t("availableSlotTrend"),
            home: t("homeVillage"),
            all: t("allVillages"),
            empty: t("empty"),
          }}
        />

        <StickyStackItem
          order={10}
          className="dashboard-section-tabs"
          role="navigation"
          aria-label={t("dashboardSections")}
        >
          <Button
            tone={dashboardSection === "villages" ? "primary" : "quiet"}
            onClick={() => scrollToDashboardSection("villages")}
          >
            {t("villages")}
          </Button>
          <Button
            tone={dashboardSection === "queue" ? "primary" : "quiet"}
            onClick={() => scrollToDashboardSection("queue")}
          >
            {t("queueTab")}
          </Button>
        </StickyStackItem>

        <section id="village-list" className="dashboard-scroll-section ui-sticky-scroll-target">
          <div className="village-grid">
            {accounts.map((account) => {
              const { builders: displayedBuilders, laboratory: displayedLaboratory } = applyDisplayOptions(
                account,
                availabilityObservations,
                displayOptions,
              );
              const displayedUpgradeSlots = account.upgradeSlots
                ? { ...account.upgradeSlots, laboratory: displayedLaboratory }
                : undefined;
              return (
                <Link
                  className="village-card-link"
                  key={account.id}
                  href={`/villages/${encodeURIComponent(account.id)}`}
                  style={{ "--accent": account.color } as React.CSSProperties}
                  aria-label={t("openVillage", { name: account.name })}
                >
                  <Card className="village-card">
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
                    <UpgradeAvailabilityPanel builders={displayedBuilders} upgradeSlots={displayedUpgradeSlots} />
                    <div className="card-foot">
                      <span>
                        {t("inProgress")} <b>{account.upgrades.length}</b>
                      </span>
                      <span>
                        {t("updated")} {formatRelative(account.lastSeen, clockNow)}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
            {!accounts.length && <EmptyState title={t("noMatches")} />}
          </div>
        </section>

        <section className="queue-section dashboard-scroll-section ui-sticky-scroll-target" id="upgrade-queue">
          <div className="section-title">
            <div>
              <p className="eyebrow">UPGRADE QUEUE</p>
              <h2>{t("queue")}</h2>
            </div>
            <span>{t("soonest")}</span>
          </div>
          <div className="queue">
            {allUpgrades.map(({ account, upgrade }, index) => {
              const duration = Math.max(1, new Date(upgrade.finishAt).getTime() - clockNow);
              const urgency = duration < 6 * 3600_000;
              const labels = { building: t("building"), hero: t("hero"), pet: t("pet"), research: t("research") };
              return (
                <Card className={urgency ? "upgrade urgent" : "upgrade"} key={`${account.id}-${upgrade.id}`}>
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
                </Card>
              );
            })}
            {!allUpgrades.length && <EmptyState title={t("empty")} />}
          </div>
        </section>
      </div>
    </main>
  );
}
