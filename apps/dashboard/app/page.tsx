"use client";

import { useEffect, useMemo, useState } from "react";
import { applyDisplayOptions, defaultDisplayOptions, observeAvailability } from "@multi-coc/upgrade-availability";
import type { DisplayOptions } from "@multi-coc/upgrade-availability";
import AdminPanel from "./admin-panel";
import { locales, useI18n } from "./i18n";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";

type Upgrade = {
  id: string;
  name: string;
  level: number;
  nextLevel?: number;
  type: "building" | "hero" | "pet" | "research";
  finishAt: string;
};

type Village = {
  id: string;
  name: string;
  tag: string;
  townHall: number;
  level: number;
  color: string;
  dataSource?: "example" | "pull" | "push" | "unknown";
  online: boolean;
  officialApiStatus?: "disabled" | "synced" | "delayed";
  lastSeen: string;
  builders: { free: number; total: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: { builders: { free: number; total: number }; laboratory: { available: boolean; active?: number; total?: number } | null } | null;
  };
  upgrades: Upgrade[];
};

type DashboardData = { generatedAt: string; accounts: Village[] };

const now = Date.now();
const demoData: DashboardData = {
  generatedAt: new Date(now - 2 * 60_000).toISOString(),
  accounts: [
    {
      id: "main",
      name: "MJY Prime",
      tag: "#2P0J8LQ",
      townHall: 17,
      level: 241,
      color: "#e9a23b",
      online: true,
      lastSeen: new Date(now - 2 * 60_000).toISOString(),
      builders: { free: 1, total: 6, regularTotal: 6 },
      upgradeSlots: { laboratory: { available: false }, petHouse: { available: true }, builderBase: { builders: { free: 1, total: 2 }, laboratory: { available: true } } },
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
      online: true,
      lastSeen: new Date(now - 5 * 60_000).toISOString(),
      builders: { free: 0, total: 6 },
      upgrades: [
        { id: "u4", name: "Monolith", level: 1, nextLevel: 2, type: "building", finishAt: new Date(now + 8.4 * 3600_000).toISOString() },
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

function Shield({ level, color }: { level: number; color: string }) {
  return <div className="shield" style={{ "--shield": color } as React.CSSProperties}><span>TH</span>{level}</div>;
}

export default function Home() {
  const { locale, setLocale, messages: t, formatDuration, formatQueueDate, formatRelative, lowerCase } = useI18n();
  const [data, setData] = useState<DashboardData>(demoEnabled ? demoData : emptyData);
  const [activeId, setActiveId] = useState("all");
  const [clockNow, setClockNow] = useState(now);
  const [demo, setDemo] = useState(demoEnabled);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "delayed">("all");
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(defaultDisplayOptions);
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const apiBase = typeof window === "undefined" ? "" : process.env.NEXT_PUBLIC_API_BASE || `${location.protocol}//${location.hostname}:8787`;
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

  const changeDisplayOption = (key: keyof DisplayOptions, value: boolean) => {
    const next = { ...displayOptions, [key]: value };
    setDisplayOptions(next);
    localStorage.setItem("multi-village-display-options", JSON.stringify(next));
  };

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE || `${location.protocol}//${location.hostname}:8787`;
    const load = () => fetch(`${base}/api/dashboard`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("offline")))
      .then((next: DashboardData) => { setData(next); setDemo(false); })
      .catch(() => setDemo(demoEnabled));
    load();
    const refresh = window.setInterval(load, 30_000);
    const clock = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, [refreshKey]);

  const liveAccounts = useMemo(() => data.accounts.map((account) => ({
    ...account,
    upgrades: account.upgrades.filter((upgrade) => new Date(upgrade.finishAt).getTime() > clockNow),
  })), [clockNow, data.accounts]);
  const visibleAccounts = useMemo(() => {
    const needle = lowerCase(query.trim());
    return liveAccounts.filter((account) => {
      const matchesQuery = !needle || [account.name, account.tag, account.id].some((value) => lowerCase(value).includes(needle));
      const matchesStatus = statusFilter === "all" || (statusFilter === "free" ? account.builders.free > 0 : account.officialApiStatus === "delayed");
      return matchesQuery && matchesStatus;
    });
  }, [liveAccounts, lowerCase, query, statusFilter]);
  const accounts = activeId === "all" ? visibleAccounts : visibleAccounts.filter((a) => a.id === activeId);
  const allUpgrades = useMemo(() => accounts.flatMap((account) => account.upgrades.map((upgrade) => ({ account, upgrade }))).sort((a, b) => +new Date(a.upgrade.finishAt) - +new Date(b.upgrade.finishAt)), [accounts]);
  const freeBuilders = liveAccounts.reduce((sum, a) => sum + a.builders.free, 0);
  const availabilityObservations = useMemo(() => observeAvailability(liveAccounts), [liveAccounts]);
  const includesExample = !demo && liveAccounts.some((account) => account.dataSource === "example");
  const next = liveAccounts.flatMap((a) => a.upgrades.map((u) => ({ ...u, account: a.name }))).sort((a, b) => +new Date(a.finishAt) - +new Date(b.finishAt))[0];

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">M</div><div><strong>MULTI VILLAGE</strong><span>COMMAND CENTER</span></div></div>
        <nav aria-label="Dashboard menu"><button className={view === "dashboard" ? "nav-active" : ""} onClick={() => setView("dashboard")}>{t.dashboard}</button><button disabled title={t.history}>{t.history}</button><button className={view === "settings" ? "nav-active" : ""} onClick={() => setView("settings")}>{t.settings}</button></nav>
        <div className="sync"><i className={demo || includesExample ? "warn" : ""} />{demo ? t.demo : includesExample ? t.exampleIncluded : `${t.synced} ${formatRelative(data.generatedAt, clockNow)}`}<div className="locale-toggle" aria-label="Language">{locales.map((option) => <button type="button" key={option} className={locale === option ? "selected" : ""} aria-pressed={locale === option} onClick={() => setLocale(option)} lang={option}>{option === "ko-KR" ? "한국어" : "English"}</button>)}</div></div>
      </header>

      {view === "settings" && apiBase && <AdminPanel apiBase={apiBase} onChanged={() => setRefreshKey((value) => value + 1)} />}
      <div className={view === "dashboard" ? "shell" : "shell hidden-view"}>
        <section className="hero-row">
          <div><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="subcopy">{t.dashboardSubtitle}</p></div>
          <div className="summary-strip">
            <div><span>{t.accounts}</span><strong>{liveAccounts.length}</strong></div>
            <div><span>{t.builders}</span><strong className={freeBuilders ? "green" : ""}>{freeBuilders}</strong></div>
            <div><span>{t.earliest}</span><strong className="small">{next ? formatDuration(next.finishAt, clockNow) : t.none}</strong></div>
          </div>
        </section>

        <div className="account-controls">
          <div className="account-tools">
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActiveId("all"); }} placeholder={t.search} aria-label={t.search} />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "all" | "free" | "delayed"); setActiveId("all"); }} aria-label={t.statusAll}>
              <option value="all">{t.statusAll}</option><option value="free">{t.freeOnly}</option><option value="delayed">{t.delayedOnly}</option>
            </select>
            <details className="display-options"><summary>{t.displayOptions}</summary><div>
              <label><input type="checkbox" checked={displayOptions.goblinResearcher} onChange={(event) => changeDisplayOption("goblinResearcher", event.target.checked)} />{t.inferGoblinResearcher}</label>
              <label><input type="checkbox" checked={displayOptions.goblinBuilder} onChange={(event) => changeDisplayOption("goblinBuilder", event.target.checked)} />{t.inferGoblinBuilder}</label>
            </div></details>
          </div>
          <div className="account-tabs" role="tablist">
            <button className={activeId === "all" ? "active" : ""} onClick={() => setActiveId("all")}>{t.all} <b>{visibleAccounts.length}</b></button>
            {visibleAccounts.map((a) => <button key={a.id} className={activeId === a.id ? "active" : ""} onClick={() => setActiveId(a.id)}><i style={{ background: a.color }} />{a.name}</button>)}
          </div>
        </div>

        <section className="village-grid">
          {accounts.map((account) => {
            const { builders: displayedBuilders, laboratory: displayedLaboratory } = applyDisplayOptions(account, availabilityObservations, displayOptions);
            const displayedUpgradeSlots = account.upgradeSlots ? { ...account.upgradeSlots, laboratory: displayedLaboratory } : undefined;
            return <article className="village-card" key={account.id} style={{ "--accent": account.color } as React.CSSProperties}>
              <div className="card-head"><Shield level={account.townHall} color={account.color} /><div><h2>{account.name}</h2><p>{account.tag} · {t.level} {account.level}</p></div><span className={`status ${account.officialApiStatus === "synced" ? "online" : account.officialApiStatus === "delayed" ? "" : "manual"}`}>{account.officialApiStatus === "synced" ? `${t.profileApi} · ${t.syncedState}` : account.officialApiStatus === "delayed" ? `${t.profileApi} · ${t.delayedState}` : t.manual}</span></div>
              <UpgradeAvailabilityPanel builders={displayedBuilders} upgradeSlots={displayedUpgradeSlots} />
              <div className="card-foot"><span>{t.inProgress} <b>{account.upgrades.length}</b></span><span>{t.updated} {formatRelative(account.lastSeen, clockNow)}</span></div>
            </article>;
          })}
          {!accounts.length && <div className="empty villages-empty">{t.noMatches}</div>}
        </section>

        <section className="queue-section">
          <div className="section-title"><div><p className="eyebrow">UPGRADE QUEUE</p><h2>{t.queue}</h2></div><span>{t.soonest}</span></div>
          <div className="queue">
            {allUpgrades.map(({ account, upgrade }, index) => {
              const duration = Math.max(1, new Date(upgrade.finishAt).getTime() - clockNow);
              const urgency = duration < 6 * 3600_000;
              const labels = { building: t.building, hero: t.hero, pet: t.pet, research: t.research };
              return <article className={urgency ? "upgrade urgent" : "upgrade"} key={`${account.id}-${upgrade.id}`}>
                <div className={`upgrade-icon ${upgrade.type}`}>{upgrade.type === "research" ? "⌁" : upgrade.type === "hero" ? "♛" : "◆"}</div>
                <div className="upgrade-info"><span>{account.name} · {labels[upgrade.type]}</span><h3>{upgrade.name}</h3><p>{t.level} {upgrade.level} → <b>{upgrade.nextLevel || upgrade.level + 1}</b></p></div>
                <div className="timeline"><div><span>{urgency ? t.soon : t.remaining}</span><strong>{formatDuration(upgrade.finishAt, clockNow)}</strong></div><em><i style={{ width: `${Math.max(12, 88 - index * 13)}%` }} /></em></div>
                <time>{formatQueueDate(upgrade.finishAt)}</time>
              </article>;
            })}
            {!allUpgrades.length && <div className="empty">{t.empty}</div>}
          </div>
        </section>
      </div>
      <footer><span>{t.dataStatus} · {demo ? t.awaiting : includesExample ? t.example : t.normal}</span><span>{t.bark} <b>{t.enabled}</b></span></footer>
    </main>
  );
}
