"use client";

import "../components/dashboard/dashboard.css";

import { Button, StaleNotice, StickyStackItem, useStickyStack } from "@multi-coc/ui";
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
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { DashboardData, Village } from "../components/dashboard/dashboard-model";
import { DashboardOverview, UpgradeQueue, VillageGrid } from "../components/dashboard/dashboard-sections";
import { dashboardQueryKey } from "./query-provider";
import { ErrorState, LoadingState } from "./request-state";
import UpgradeCharts from "./upgrade-charts";
import { useDashboardFormat } from "./use-dashboard-format";
import VillageDetail from "./village-detail";

const emptyData: DashboardData = { generatedAt: new Date(0).toISOString(), accounts: [] };
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
const browserApiBase = () =>
  configuredApiBase === "same-origin" ? "" : configuredApiBase || `${location.protocol}//${location.hostname}:8787`;

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
        <DashboardOverview
          query={query}
          setQuery={setQuery}
          availabilityFilter={availabilityFilter}
          setAvailabilityFilter={setAvailabilityFilter}
          refreshOnly={refreshOnly}
          setRefreshOnly={setRefreshOnly}
          displayOptions={displayOptions}
          onDisplayOptionChange={changeDisplayOption}
          prioritizeAvailable={prioritizeAvailable}
          setPrioritizeAvailable={(value) => {
            setPrioritizeAvailable(value);
            localStorage.setItem("multi-village-prioritize-available", String(value));
          }}
          selectedTag={selectedTag}
          setSelectedTag={setActiveTag}
          visibleCount={visibleAccounts.length}
          tagOptions={tagOptions}
          accountCount={accounts.length}
          availabilitySummary={availabilitySummary}
          next={next}
          clockNow={clockNow}
          formatDuration={formatDuration}
        />

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

        <VillageGrid
          accounts={accounts}
          availabilityObservations={availabilityObservations}
          displayOptions={displayOptions}
          clockNow={clockNow}
          formatRelative={formatRelative}
        />

        <UpgradeQueue
          upgrades={allUpgrades}
          clockNow={clockNow}
          formatDuration={formatDuration}
          formatQueueDate={formatQueueDate}
        />
      </div>
    </main>
  );
}
