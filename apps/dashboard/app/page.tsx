"use client";

import { useEffect, useMemo, useState } from "react";
import { applyDisplayOptions, buildUpgradeChartData, defaultDisplayOptions, matchesAvailabilityFilter, observeAvailability, summarizeAvailability } from "@multi-coc/upgrade-availability";
import type { AvailabilityFilter, DisplayOptions } from "@multi-coc/upgrade-availability";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AdminPanel from "./admin-panel";
import HistoryPanel from "./history-panel";
import LocaleSwitcher from "./locale-switcher";
import PwaInstall from "./pwa-install";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";
import UpgradeCharts from "./upgrade-charts";
import VillageDetail from "./village-detail";
import { useDashboardFormat } from "./use-dashboard-format";

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
  dataSource?: string;
  online: boolean;
  refreshRequired?: boolean;
  refreshCompletedAt?: string | null;
  lastSeen: string;
  builders: { free: number; total: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: { builders: { free: number; total: number }; laboratory: { available: boolean; active?: number; total?: number } | null } | null;
  };
  cooldowns?: { clockTower: string | null; helpers: Array<{ dataId: number; availableAt: string }> };
  helpers?: Array<{ dataId: number; name: string; level: number; availableAt: string | null }>;
  heroEquipment?: Array<{ dataId: number; name: string; level: number }>;
  officialStats?: { trophies: number; bestTrophies: number; league: string | null; warStars: number; donations: number; donationsReceived: number; capitalContributions: number };
  upgrades: Upgrade[];
};

type DashboardData = { generatedAt: string; accounts: Village[]; groupOrder?: string[] };
type SettingsSection = "import" | "alerts" | "villages" | "groups";
const settingsPath = (section: SettingsSection) => `/settings/${section === "import" ? "paste" : section === "alerts" ? "upgrades" : section}`;

const now = Date.now();
const demoData: DashboardData = {
  generatedAt: new Date(now - 2 * 60_000).toISOString(),
  groupOrder: ["War", "Main", "Mini"],
  accounts: [
    {
      id: "main",
      name: "MJY Prime",
      tag: "#2P0J8LQ",
      townHall: 17,
      level: 241,
      color: "#e9a23b",
      tags: ["Main", "War"],
      online: true,
      lastSeen: new Date(now - 2 * 60_000).toISOString(),
      builders: { free: 1, total: 6, regularTotal: 6 },
      upgradeSlots: { laboratory: { available: false }, petHouse: { available: true }, builderBase: { builders: { free: 1, total: 2 }, laboratory: { available: true } } },
      cooldowns: { clockTower: new Date(now + 2 * 3600_000).toISOString(), helpers: [{ dataId: 93000000, availableAt: new Date(now + 6 * 3600_000).toISOString() }] },
      upgrades: [
        { id: "u1", name: "Inferno Artillery", level: 2, nextLevel: 3, type: "building", finishAt: new Date(now + 2.7 * 3600_000).toISOString() },
        { id: "u2", name: "Archer Queen", level: 96, nextLevel: 97, type: "hero", finishAt: new Date(now + 1.35 * 86400_000).toISOString() },
        { id: "u3", name: "Root Rider", level: 3, nextLevel: 4, type: "research", finishAt: new Date(now + 3.2 * 86400_000).toISOString() },
      ],
    },
    {
      id: "rush",
      name: "Builder Rush",
      tag: "#8G2Y1V9",
      townHall: 15,
      level: 187,
      color: "#4ea58c",
      tags: ["War"],
      online: true,
      lastSeen: new Date(now - 5 * 60_000).toISOString(),
      builders: { free: 0, total: 6 },
      upgrades: [
        { id: "u4", name: "Multi Mortar", level: 9, nextLevel: 10, type: "building", base: "builder", finishAt: new Date(now + 8.4 * 3600_000).toISOString() },
        { id: "u5", name: "Royal Champion", level: 37, nextLevel: 38, type: "hero", finishAt: new Date(now + 2.1 * 86400_000).toISOString() },
      ],
    },
    {
      id: "mini",
      name: "Tiny Titan",
      tag: "#QL8V29P",
      townHall: 12,
      level: 119,
      color: "#718ccc",
      tags: ["Mini"],
      online: false,
      lastSeen: new Date(now - 41 * 60_000).toISOString(),
      builders: { free: 2, total: 5 },
      upgrades: [
        { id: "u6", name: "Town Hall", level: 12, nextLevel: 13, type: "building", finishAt: new Date(now + 5.7 * 86400_000).toISOString() },
      ],
    },
  ],
};
const emptyData: DashboardData = { generatedAt: new Date(0).toISOString(), accounts: [] };
const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE;
const browserApiBase = () => configuredApiBase === "same-origin" ? "" : configuredApiBase || `${location.protocol}//${location.hostname}:8787`;

function Shield({ level, color }: { level: number; color: string }) {
  return <div className="shield" style={{ "--shield": color } as React.CSSProperties}><span>TH</span>{level}</div>;
}

export default function Home({ initialVillageId = null, initialSettingsSection = null, initialSettingsVillageId = null, initialHistoryVillageId }: { initialVillageId?: string | null; initialSettingsSection?: SettingsSection | null; initialSettingsVillageId?: string | null; initialHistoryVillageId?: string } = {}) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const { formatDateTime, formatDuration, formatQueueDate, formatRelative, lowerCase } = useDashboardFormat();
  const [data, setData] = useState<DashboardData>(demoEnabled ? demoData : emptyData);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState(now);
  const [demo, setDemo] = useState(demoEnabled);
  const [query, setQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [refreshOnly, setRefreshOnly] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(defaultDisplayOptions);
  const [prioritizeAvailable, setPrioritizeAvailable] = useState(false);
  const [view, setView] = useState<"dashboard" | "village" | "history" | "settings">(initialHistoryVillageId !== undefined ? "history" : initialVillageId ? "village" : initialSettingsSection || initialSettingsVillageId ? "settings" : "dashboard");
  const [selectedVillageId] = useState<string | null>(initialVillageId);
  const [dashboardSection, setDashboardSection] = useState<"villages" | "queue">("villages");
  const [manageVillageId, setManageVillageId] = useState<string | null>(initialSettingsVillageId);
  const [quickPasteRequest, setQuickPasteRequest] = useState<{ id: number; text: string; clipboardError: boolean } | null>(null);
  const [quickPasteLoading, setQuickPasteLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const apiBase = typeof window === "undefined" ? "" : browserApiBase();
  useEffect(() => {
    const saved = localStorage.getItem("multi-village-display-options");
    if (!saved) return;
    const timer = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(saved) as Partial<DisplayOptions>;
        setDisplayOptions((current) => ({ ...current, ...parsed }));
      } catch { /* Ignore invalid browser state. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setPrioritizeAvailable(localStorage.getItem("multi-village-prioritize-available") === "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const changeDisplayOption = (key: keyof DisplayOptions, value: boolean) => {
    const next = { ...displayOptions, [key]: value };
    setDisplayOptions(next);
    localStorage.setItem("multi-village-display-options", JSON.stringify(next));
  };

  useEffect(() => {
    const base = browserApiBase();
    const load = () => fetch(`${base}/api/dashboard`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("offline")))
      .then((next: DashboardData) => { setData(next); setDemo(false); })
      .catch(() => setDemo(demoEnabled));
    load();
    const refresh = window.setInterval(load, 30_000);
    const clock = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, [refreshKey]);

  useEffect(() => {
    if (view !== "dashboard") return;
    const updateSection = () => {
      const queue = document.getElementById("upgrade-queue");
      setDashboardSection(queue && queue.getBoundingClientRect().top <= 150 ? "queue" : "villages");
    };
    updateSection();
    window.addEventListener("scroll", updateSection, { passive: true });
    return () => window.removeEventListener("scroll", updateSection);
  }, [view]);

  const scrollToDashboardSection = (section: "villages" | "queue") => {
    setDashboardSection(section);
    document.getElementById(section === "villages" ? "village-list" : "upgrade-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openVillageSettings = (accountId: string) => {
    router.push(`/settings/villages/${encodeURIComponent(accountId)}`);
  };

  const openVillage = (accountId: string) => {
    router.push(`/villages/${encodeURIComponent(accountId)}`);
  };

  const quickPaste = async () => {
    setQuickPasteLoading(true);
    let text = ""; let clipboardError = false;
    try {
      text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("empty clipboard");
    } catch {
      clipboardError = true;
    }
    setQuickPasteRequest((current) => ({ id: (current?.id || 0) + 1, text, clipboardError }));
    setManageVillageId(null);
    setView("settings");
    router.push("/settings/paste");
    setQuickPasteLoading(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const liveAccounts = useMemo(() => data.accounts.map((account) => ({
    ...account,
    upgrades: account.upgrades.filter((upgrade) => new Date(upgrade.finishAt).getTime() > clockNow),
  })), [clockNow, data.accounts]);
  const availabilityObservations = useMemo(() => observeAvailability(liveAccounts), [liveAccounts]);
  const visibleAccounts = useMemo(() => {
    const needle = lowerCase(query.trim());
    return liveAccounts.filter((account) => {
      const matchesQuery = !needle || [account.name, account.tag, account.id, ...(account.tags || [])].some((value) => lowerCase(value).includes(needle));
      return matchesQuery
        && matchesAvailabilityFilter(account, availabilityFilter, availabilityObservations, displayOptions)
        && (!refreshOnly || Boolean(account.refreshRequired));
    });
  }, [availabilityFilter, availabilityObservations, displayOptions, liveAccounts, lowerCase, query, refreshOnly]);
  const tagOptions = useMemo(() => {
    const options = new Map<string, { label: string; count: number }>();
    for (const account of visibleAccounts) for (const tag of account.tags || []) {
      const key = lowerCase(tag);
      const option = options.get(key);
      options.set(key, { label: option?.label || tag, count: (option?.count || 0) + 1 });
    }
    const order = new Map((data.groupOrder || []).map((tag, index) => [lowerCase(tag), index]));
    return [...options.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => {
      const aOrder = order.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = order.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.label.localeCompare(b.label);
    });
  }, [data.groupOrder, lowerCase, visibleAccounts]);
  const selectedTag = activeTag !== null && tagOptions.some((tag) => tag.key === activeTag) ? activeTag : null;
  const accounts = useMemo(() => {
    const filtered = selectedTag === null ? visibleAccounts : visibleAccounts.filter((account) => (account.tags || []).some((tag) => lowerCase(tag) === selectedTag));
    if (!prioritizeAvailable) return filtered;
    const canStartUpgrade = (account: Village) => {
      const displayed = applyDisplayOptions(account, availabilityObservations, displayOptions);
      return displayed.builders.free > 0 || Boolean(displayed.laboratory?.available)
        || Boolean(account.upgradeSlots?.petHouse?.available)
        || Boolean(account.upgradeSlots?.builderBase?.builders.free)
        || Boolean(account.upgradeSlots?.builderBase?.laboratory?.available);
    };
    return filtered.map((account, index) => ({ account, index, available: canStartUpgrade(account) }))
      .sort((a, b) => Number(b.available) - Number(a.available) || a.index - b.index).map(({ account }) => account);
  }, [availabilityObservations, displayOptions, lowerCase, prioritizeAvailable, selectedTag, visibleAccounts]);
  const allUpgrades = useMemo(() => accounts.flatMap((account) => account.upgrades.map((upgrade) => ({ account, upgrade }))).sort((a, b) => +new Date(a.upgrade.finishAt) - +new Date(b.upgrade.finishAt)), [accounts]);
  const availabilitySummary = summarizeAvailability(accounts, availabilityObservations, displayOptions);
  const upgradeChartData = useMemo(() => buildUpgradeChartData(allUpgrades.map(({ upgrade }) => upgrade), availabilitySummary.homeVillage, availabilitySummary.builderBase, clockNow), [allUpgrades, availabilitySummary.builderBase, availabilitySummary.homeVillage, clockNow]);
  const includesExample = !demo && liveAccounts.some((account) => account.dataSource === "example");
  const next = allUpgrades[0]?.upgrade;

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">M</div><div><strong>MULTI VILLAGE</strong><span>COMMAND CENTER</span></div></div>
        <nav aria-label="Dashboard menu"><button className={view === "dashboard" || view === "village" ? "nav-active" : ""} onClick={() => router.push("/")}>{t("dashboard")}</button><button className={view === "history" ? "nav-active" : ""} onClick={() => router.push("/history")}>{t("history")}</button><button className={view === "settings" ? "nav-active" : ""} onClick={() => router.push("/settings/paste")}>{t("settings")}</button><button className="quick-paste-nav" disabled={quickPasteLoading} onClick={quickPaste}>{quickPasteLoading ? t("quickPasteReading") : t("quickPaste")}</button></nav>
        <PwaInstall />
        <div className="sync"><i className={demo || includesExample ? "warn" : ""} />{demo ? t("demo") : includesExample ? t("exampleIncluded") : `${t("synced")} ${formatRelative(data.generatedAt, clockNow)}`}<LocaleSwitcher /></div>
      </header>

      {view === "settings" && <AdminPanel apiBase={apiBase} onChanged={() => setRefreshKey((value) => value + 1)} onSectionChange={(section) => router.push(settingsPath(section))} onVillageChange={(accountId) => router.push(`/settings/villages/${encodeURIComponent(accountId)}`)} initialSection={manageVillageId ? "villages" : initialSettingsSection || "import"} initialAccountId={manageVillageId} quickPasteRequest={quickPasteRequest} />}
      {view === "history" && <HistoryPanel apiBase={apiBase} initialVillageId={initialHistoryVillageId} />}
      {view === "village" && selectedVillageId && liveAccounts.find((account) => account.id === selectedVillageId) && <VillageDetail village={liveAccounts.find((account) => account.id === selectedVillageId)!} now={clockNow} formatDuration={formatDuration} formatDateTime={formatDateTime} onBack={() => router.push("/")} onHistory={() => router.push(`/history?village=${encodeURIComponent(selectedVillageId)}`)} onSettings={() => openVillageSettings(selectedVillageId)} />}
      {view === "village" && selectedVillageId && !demo && data.accounts.length > 0 && !liveAccounts.some((account) => account.id === selectedVillageId) && <section className="village-route-missing shell"><h1>{t("villageNotFound")}</h1><button onClick={() => router.push("/")}>← {t("backToDashboard")}</button></section>}
      <div className={view === "dashboard" ? "shell" : "shell hidden-view"}>
        <section className="dashboard-hero">
          <div className="hero-copy"><p className="eyebrow">{t("eyebrow")}</p><h1>{t("title")}</h1><p className="subcopy">{t("subtitle")}</p></div>
          <div className="account-controls dashboard-filters">
            <div className="account-tools">
              <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActiveTag(null); }} placeholder={t("search")} aria-label={t("search")} />
              <div className="availability-filter" role="radiogroup" aria-label={t("availabilityFilter")}>
                {(["all", "home", "any"] as const).map((filter) => <label key={filter}><input type="radio" name="availability" checked={availabilityFilter === filter} onChange={() => { setAvailabilityFilter(filter); setActiveTag(null); }} />{t(filter === "all" ? "statusAll" : filter === "home" ? "homeSlotAvailable" : "anySlotAvailable")}</label>)}
              </div>
              <label className="refresh-filter"><input type="checkbox" checked={refreshOnly} onChange={(event) => { setRefreshOnly(event.target.checked); setActiveTag(null); }} />{t("refreshRequired")}</label>
              <details className="display-options"><summary>{t("displayOptions")}</summary><div>
                <label><input type="checkbox" checked={displayOptions.goblinResearcher} onChange={(event) => changeDisplayOption("goblinResearcher", event.target.checked)} />{t("inferGoblinResearcher")}</label>
                <label><input type="checkbox" checked={displayOptions.goblinBuilder} onChange={(event) => changeDisplayOption("goblinBuilder", event.target.checked)} />{t("inferGoblinBuilder")}</label>
                <label><input type="checkbox" checked={prioritizeAvailable} onChange={(event) => { setPrioritizeAvailable(event.target.checked); localStorage.setItem("multi-village-prioritize-available", String(event.target.checked)); }} />{t("prioritizeAvailable")}</label>
              </div></details>
            </div>
            <div className="account-tabs" role="tablist">
              <button className={selectedTag === null ? "active" : ""} onClick={() => setActiveTag(null)}>{t("all")} <b>{visibleAccounts.length}</b></button>
              {tagOptions.map((tag) => <button key={tag.key} className={selectedTag === tag.key ? "active" : ""} onClick={() => setActiveTag(tag.key)}><span className="tag-hash">#</span>{tag.label} <b>{tag.count}</b></button>)}
            </div>
          </div>
          <div className="summary-strip">
            <div><span>{t("accounts")}</span><strong>{accounts.length}</strong></div>
            <div><span>{t("homeVillageIdle")}</span><strong className={availabilitySummary.homeVillage ? "green" : ""}>{availabilitySummary.homeVillage}</strong></div>
            <div className="builder-base-summary"><span>{t("builderBaseIdle")}</span><strong className={availabilitySummary.builderBase ? "green" : ""}>{availabilitySummary.builderBase}</strong></div>
            <div><span>{t("earliest")}</span><strong className="small">{next ? formatDuration(next.finishAt, clockNow) : t("none")}</strong></div>
          </div>
        </section>

        <UpgradeCharts bins={upgradeChartData.bins} timeline={upgradeChartData.timeline} formatTime={(value) => formatQueueDate(new Date(value).toISOString())} labels={{ title: t("upgradeOutlook"), description: t("upgradeOutlookHelp"), completions: t("completionDistribution"), active: t("activeUpgradeTrend"), available: t("availableSlotTrend"), home: t("homeVillage"), all: t("allVillages"), empty: t("empty") }} />

        <div className="dashboard-section-tabs section-tabs" role="navigation" aria-label={t("dashboardSections")}>
          <button className={dashboardSection === "villages" ? "active" : ""} onClick={() => scrollToDashboardSection("villages")}>{t("villages")}</button>
          <button className={dashboardSection === "queue" ? "active" : ""} onClick={() => scrollToDashboardSection("queue")}>{t("queueTab")}</button>
        </div>

        <section id="village-list" className="dashboard-scroll-section">
          <div className="village-grid">
          {accounts.map((account) => {
            const { builders: displayedBuilders, laboratory: displayedLaboratory } = applyDisplayOptions(account, availabilityObservations, displayOptions);
            const displayedUpgradeSlots = account.upgradeSlots ? { ...account.upgradeSlots, laboratory: displayedLaboratory } : undefined;
            return <article className="village-card village-card-link" key={account.id} style={{ "--accent": account.color } as React.CSSProperties} role="button" tabIndex={0} aria-label={t("openVillage", { name: account.name })} onClick={() => openVillage(account.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openVillage(account.id); } }}>
              <div className="card-head"><Shield level={account.townHall} color={account.color} /><div><h2>{account.name}</h2><p>{account.tag} · {t("level")} {account.level}</p></div>{account.refreshRequired && <span className="status refresh-needed">{t("refreshRequired")}</span>}</div>
              {!!account.tags?.length && <div className="account-tag-list">{account.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
              <UpgradeAvailabilityPanel builders={displayedBuilders} upgradeSlots={displayedUpgradeSlots} />
              <div className="card-foot"><span>{t("inProgress")} <b>{account.upgrades.length}</b></span><span>{t("updated")} {formatRelative(account.lastSeen, clockNow)}</span></div>
            </article>;
          })}
          {!accounts.length && <div className="empty villages-empty">{t("noMatches")}</div>}
          </div>
        </section>

        <section className="queue-section dashboard-scroll-section" id="upgrade-queue">
          <div className="section-title"><div><p className="eyebrow">UPGRADE QUEUE</p><h2>{t("queue")}</h2></div><span>{t("soonest")}</span></div>
          <div className="queue">
            {allUpgrades.map(({ account, upgrade }, index) => {
              const duration = Math.max(1, new Date(upgrade.finishAt).getTime() - clockNow);
              const urgency = duration < 6 * 3600_000;
              const labels = { building: t("building"), hero: t("hero"), pet: t("pet"), research: t("research") };
              return <article className={urgency ? "upgrade urgent" : "upgrade"} key={`${account.id}-${upgrade.id}`}>
                <div className={`upgrade-icon ${upgrade.type}`}>{upgrade.type === "research" ? "⌁" : upgrade.type === "hero" ? "♛" : "◆"}</div>
                <div className="upgrade-info"><span>{account.name} · {labels[upgrade.type]}</span><h3>{upgrade.name}</h3><p>{t("level")} {upgrade.level} → <b>{upgrade.nextLevel || upgrade.level + 1}</b></p></div>
                <div className="timeline"><div><span>{urgency ? t("soon") : t("remaining")}</span><strong>{formatDuration(upgrade.finishAt, clockNow)}</strong></div><em><i style={{ width: `${Math.max(12, 88 - index * 13)}%` }} /></em></div>
                <time>{formatQueueDate(upgrade.finishAt)}</time>
              </article>;
            })}
            {!allUpgrades.length && <div className="empty">{t("empty")}</div>}
          </div>
        </section>
      </div>
      <footer><span>{t("dataStatus")} · {demo ? t("awaiting") : includesExample ? t("example") : t("normal")}</span><span>{t("bark")} <b>{t("enabled")}</b></span></footer>
    </main>
  );
}
