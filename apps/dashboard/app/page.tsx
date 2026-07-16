"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./admin-panel";

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
  lastSeen: string;
  builders: { free: number; total: number };
  upgradeSlots?: {
    laboratory: { available: boolean } | null;
    petHouse: { available: boolean } | null;
    builderBase: { builders: { free: number; total: number }; laboratory: { available: boolean } | null } | null;
  };
  resources: { gold: number; elixir: number; darkElixir: number; capacity: number } | null;
  upgrades: Upgrade[];
};

type DashboardData = { generatedAt: string; accounts: Village[] };
type Locale = "ko" | "en";

const messages = {
  ko: {
    dashboard: "대시보드", history: "히스토리", settings: "알림 설정", demo: "데모 데이터", synced: "마지막 동기화", eyebrow: "VILLAGE OVERVIEW", title: "오늘의 마을 현황", subtitle: "모든 계정의 빌더와 연구 진행 상황을 한곳에서 확인하세요.", accounts: "운영 계정", builders: "대기 빌더", earliest: "가장 빠른 완료", none: "없음", all: "전체 계정", normal: "정상", delayed: "지연", builder: "빌더", waiting: "명 대기 중", inProgress: "진행 중", updated: "업데이트", queue: "완료 예정 업그레이드", soonest: "빠른 순서", soon: "곧 완료", remaining: "남은 시간", underMinute: "1분 미만", empty: "진행 중인 업그레이드가 없습니다.", dataStatus: "JSONL 수집 상태", awaiting: "연결 대기 중", bark: "Bark 알림", enabled: "활성", building: "건물", hero: "영웅", pet: "펫", research: "연구소", level: "레벨", gold: "골드", elixir: "엘릭서", dark: "다크 엘릭서", day: "일", hour: "시간", minute: "분", ago: "전", justNow: "방금", search: "계정 이름·태그 검색", statusAll: "모든 상태", freeOnly: "대기 빌더 있음", delayedOnly: "동기화 지연", noMatches: "조건에 맞는 계정이 없습니다.", resourceUnknown: "자원 정보 없음", resourceHint: "게임 export에는 현재 보유 자원이 없습니다. 상태 서버 데이터가 연결되면 표시됩니다.", farmEmpty: "자원 데이터를 제공한 마을이 없어 우선순위를 계산하지 않았습니다.", farmTitle: "파밍 우선순위", farmSubtitle: "자원 부족률과 대기 빌더를 기준으로 지금 돌볼 마을을 정렬했습니다.", heuristic: "계획 중인 업그레이드 비용이 연결되기 전까지 골드·엘릭서 부족률 75%, 대기 빌더 비율 25%로 계산합니다.", farmNow: "지금 파밍", farmNext: "다음 순서", farmSteady: "여유", goldLow: "골드 우선", elixirLow: "엘릭서 우선", builderReady: "빌더 대기", fillRate: "보유율", available: "업그레이드 가능", busy: "진행 중", petHouse: "펫", builderBaseBuilder: "장인기지 장인", builderBaseLab: "장인기지 연구소" },
  en: {
    dashboard: "Dashboard", history: "History", settings: "Alerts", demo: "Demo data", synced: "Last sync", eyebrow: "VILLAGE OVERVIEW", title: "Village status today", subtitle: "Track builders, research, and resources across every account.", accounts: "Accounts", builders: "Free builders", earliest: "Next completion", none: "None", all: "All accounts", normal: "Live", delayed: "Delayed", builder: "Builders", waiting: " available", inProgress: "In progress", updated: "Updated", queue: "Upcoming completions", soonest: "Soonest first", soon: "Finishing soon", remaining: "Time left", underMinute: "Under 1m", empty: "No upgrades are currently running.", dataStatus: "JSONL collector", awaiting: "Awaiting connection", bark: "Bark alerts", enabled: "On", building: "Building", hero: "Hero", pet: "Pet", research: "Laboratory", level: "Level", gold: "Gold", elixir: "Elixir", dark: "Dark Elixir", day: "d", hour: "h", minute: "m", ago: "ago", justNow: "Just now", search: "Search name or tag", statusAll: "All statuses", freeOnly: "Builder available", delayedOnly: "Sync delayed", noMatches: "No accounts match these filters.", resourceUnknown: "Resources unavailable", resourceHint: "Game exports do not include current resources. They appear after a status source is connected.", farmEmpty: "Farming priority is unavailable because no village has resource data.", farmTitle: "Farming priority", farmSubtitle: "Villages are ranked by resource shortage and available builders.", heuristic: "Until planned upgrade costs are connected, the score uses 75% gold/elixir shortage and 25% free-builder ratio.", farmNow: "Farm now", farmNext: "Up next", farmSteady: "Steady", goldLow: "Prioritize gold", elixirLow: "Prioritize elixir", builderReady: "Builder ready", fillRate: "Filled", available: "Upgrade available", busy: "In progress", petHouse: "Pet", builderBaseBuilder: "Builder Base builders", builderBaseLab: "Builder Base lab" },
} as const;

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
      builders: { free: 1, total: 6 },
      upgradeSlots: { laboratory: { available: false }, petHouse: { available: true }, builderBase: { builders: { free: 1, total: 2 }, laboratory: { available: true } } },
      resources: { gold: 17_400_000, elixir: 9_300_000, darkElixir: 281_000, capacity: 22_000_000 },
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
      resources: { gold: 8_100_000, elixir: 14_700_000, darkElixir: 164_000, capacity: 20_000_000 },
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
      resources: { gold: 7_900_000, elixir: 6_400_000, darkElixir: 71_000, capacity: 12_000_000 },
      upgrades: [
        { id: "u6", name: "Town Hall", level: 12, nextLevel: 13, type: "building", finishAt: new Date(now + 5.7 * 86400_000).toISOString() },
      ],
    },
  ],
};
const emptyData: DashboardData = { generatedAt: new Date(0).toISOString(), accounts: [] };
const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const fmtNumber = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`;
const remaining = (finishAt: string, locale: Locale, reference: number) => {
  const t = messages[locale];
  const ms = Math.max(0, new Date(finishAt).getTime() - reference);
  if (ms < 60_000) return t.underMinute;
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return locale === "ko" ? (d ? `${d}${t.day} ${h}${t.hour}` : h ? `${h}${t.hour} ${m}${t.minute}` : `${m}${t.minute}`) : (d ? `${d}${t.day} ${h}${t.hour}` : h ? `${h}${t.hour} ${m}${t.minute}` : `${m}${t.minute}`);
};
const relative = (date: string, locale: Locale, reference: number) => {
  const t = messages[locale];
  const mins = Math.max(0, Math.round((reference - new Date(date).getTime()) / 60_000));
  if (mins < 1) return t.justNow;
  return locale === "ko" ? (mins < 60 ? `${mins}${t.minute} ${t.ago}` : `${Math.floor(mins / 60)}${t.hour} ${t.ago}`) : (mins < 60 ? `${mins}${t.minute} ${t.ago}` : `${Math.floor(mins / 60)}${t.hour} ${t.ago}`);
};

function Shield({ level, color }: { level: number; color: string }) {
  return <div className="shield" style={{ "--shield": color } as React.CSSProperties}><span>TH</span>{level}</div>;
}

export default function Home() {
  const [data, setData] = useState<DashboardData>(demoEnabled ? demoData : emptyData);
  const [activeId, setActiveId] = useState("all");
  const [clockNow, setClockNow] = useState(now);
  const [demo, setDemo] = useState(demoEnabled);
  const [locale, setLocale] = useState<Locale>("ko");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "free" | "delayed">("all");
  const [view, setView] = useState<"dashboard" | "settings">("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const apiBase = typeof window === "undefined" ? "" : process.env.NEXT_PUBLIC_API_BASE || `${location.protocol}//${location.hostname}:8787`;
  const t = messages[locale];

  useEffect(() => {
    const saved = localStorage.getItem("multi-village-locale");
    const timer = window.setTimeout(() => {
      if (saved === "ko" || saved === "en") {
        setLocale(saved);
        document.documentElement.lang = saved;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const changeLocale = (next: Locale) => {
    setLocale(next);
    localStorage.setItem("multi-village-locale", next);
    document.documentElement.lang = next;
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
    const needle = query.trim().toLocaleLowerCase(locale === "ko" ? "ko-KR" : "en-US");
    return liveAccounts.filter((account) => {
      const matchesQuery = !needle || [account.name, account.tag, account.id].some((value) => value.toLocaleLowerCase().includes(needle));
      const matchesStatus = statusFilter === "all" || (statusFilter === "free" ? account.builders.free > 0 : !account.online);
      return matchesQuery && matchesStatus;
    });
  }, [liveAccounts, locale, query, statusFilter]);
  const accounts = activeId === "all" ? visibleAccounts : visibleAccounts.filter((a) => a.id === activeId);
  const allUpgrades = useMemo(() => accounts.flatMap((account) => account.upgrades.map((upgrade) => ({ account, upgrade }))).sort((a, b) => +new Date(a.upgrade.finishAt) - +new Date(b.upgrade.finishAt)), [accounts]);
  const farmingPriority = useMemo(() => liveAccounts.flatMap((account) => {
    if (!account.resources || account.resources.capacity <= 1) return [];
    const capacity = account.resources.capacity;
    const goldFill = Math.min(1, account.resources.gold / capacity);
    const elixirFill = Math.min(1, account.resources.elixir / capacity);
    const shortage = 1 - ((goldFill + elixirFill) / 2);
    const freeBuilderRatio = account.builders.total ? account.builders.free / account.builders.total : 0;
    return [{ account, goldFill, elixirFill, score: shortage * .75 + freeBuilderRatio * .25 }];
  }).sort((a, b) => b.score - a.score), [liveAccounts]);
  const freeBuilders = liveAccounts.reduce((sum, a) => sum + a.builders.free, 0);
  const includesExample = !demo && liveAccounts.some((account) => account.dataSource === "example");
  const next = liveAccounts.flatMap((a) => a.upgrades.map((u) => ({ ...u, account: a.name }))).sort((a, b) => +new Date(a.finishAt) - +new Date(b.finishAt))[0];

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="brand-mark">M</div><div><strong>MULTI VILLAGE</strong><span>COMMAND CENTER</span></div></div>
        <nav aria-label="Dashboard menu"><button className={view === "dashboard" ? "nav-active" : ""} onClick={() => setView("dashboard")}>{t.dashboard}</button><button disabled title={t.history}>{t.history}</button><button className={view === "settings" ? "nav-active" : ""} onClick={() => setView("settings")}>{t.settings}</button></nav>
        <div className="sync"><i className={demo || includesExample ? "warn" : ""} />{demo ? t.demo : includesExample ? (locale === "ko" ? "예제 데이터 포함" : "Includes example data") : `${t.synced} ${relative(data.generatedAt, locale, clockNow)}`}<div className="locale-toggle"><button className={locale === "ko" ? "selected" : ""} onClick={() => changeLocale("ko")}>KO</button><button className={locale === "en" ? "selected" : ""} onClick={() => changeLocale("en")}>EN</button></div></div>
      </header>

      {view === "settings" && apiBase && <AdminPanel locale={locale} apiBase={apiBase} onChanged={() => setRefreshKey((value) => value + 1)} />}
      <div className={view === "dashboard" ? "shell" : "shell hidden-view"}>
        <section className="hero-row">
          <div><p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="subcopy">{t.subtitle}</p></div>
          <div className="summary-strip">
            <div><span>{t.accounts}</span><strong>{liveAccounts.length}</strong></div>
            <div><span>{t.builders}</span><strong className={freeBuilders ? "green" : ""}>{freeBuilders}</strong></div>
            <div><span>{t.earliest}</span><strong className="small">{next ? remaining(next.finishAt, locale, clockNow) : t.none}</strong></div>
          </div>
        </section>

        <div className="account-controls">
          <div className="account-tools">
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActiveId("all"); }} placeholder={t.search} aria-label={t.search} />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "all" | "free" | "delayed"); setActiveId("all"); }} aria-label={t.statusAll}>
              <option value="all">{t.statusAll}</option><option value="free">{t.freeOnly}</option><option value="delayed">{t.delayedOnly}</option>
            </select>
          </div>
          <div className="account-tabs" role="tablist">
            <button className={activeId === "all" ? "active" : ""} onClick={() => setActiveId("all")}>{t.all} <b>{visibleAccounts.length}</b></button>
            {visibleAccounts.map((a) => <button key={a.id} className={activeId === a.id ? "active" : ""} onClick={() => setActiveId(a.id)}><i style={{ background: a.color }} />{a.name}</button>)}
          </div>
        </div>

        <section className="village-grid">
          {accounts.map((account) => {
            const goldPct = account.resources ? Math.min(100, account.resources.gold / account.resources.capacity * 100) : 0;
            const elixirPct = account.resources ? Math.min(100, account.resources.elixir / account.resources.capacity * 100) : 0;
            return <article className="village-card" key={account.id} style={{ "--accent": account.color } as React.CSSProperties}>
              <div className="card-head"><Shield level={account.townHall} color={account.color} /><div><h2>{account.name}</h2><p>{account.tag} · {t.level} {account.level}</p></div><span className={account.online ? "status online" : "status"}>{account.online ? t.normal : t.delayed}</span></div>
              <div className="builder-line"><div className="hammer">◆</div><div><span>{t.builder}</span><strong>{account.builders.free}{t.waiting}</strong></div><div className="builder-dots" aria-label={`${account.builders.free} free builders`}>{Array.from({ length: account.builders.total }, (_, i) => <i className={i < account.builders.total - account.builders.free ? "busy" : ""} key={i} />)}</div></div>
              {account.upgradeSlots && <div className="upgrade-slots">
                {account.upgradeSlots.laboratory && <div className={account.upgradeSlots.laboratory.available ? "ready" : ""}><span>{t.research}</span><strong>{account.upgradeSlots.laboratory.available ? t.available : t.busy}</strong></div>}
                {account.upgradeSlots.petHouse && <div className={account.upgradeSlots.petHouse.available ? "ready" : ""}><span>{t.petHouse}</span><strong>{account.upgradeSlots.petHouse.available ? t.available : t.busy}</strong></div>}
                {account.upgradeSlots.builderBase && <div className={account.upgradeSlots.builderBase.builders.free > 0 ? "ready" : ""}><span>{t.builderBaseBuilder}</span><strong>{account.upgradeSlots.builderBase.builders.free > 0 ? `${t.available} ${account.upgradeSlots.builderBase.builders.free}` : t.busy}</strong></div>}
                {account.upgradeSlots.builderBase?.laboratory && <div className={account.upgradeSlots.builderBase.laboratory.available ? "ready" : ""}><span>{t.builderBaseLab}</span><strong>{account.upgradeSlots.builderBase.laboratory.available ? t.available : t.busy}</strong></div>}
              </div>}
              {account.resources ? <div className="resources">
                <div><span><i className="gold-dot" />{t.gold} <b>{fmtNumber(account.resources.gold)}</b></span><em><i style={{ width: `${goldPct}%` }} /></em></div>
                <div><span><i className="elixir-dot" />{t.elixir} <b>{fmtNumber(account.resources.elixir)}</b></span><em><i style={{ width: `${elixirPct}%` }} /></em></div>
                <div className="dark-resource"><span><i className="dark-dot" />{t.dark}</span><b>{fmtNumber(account.resources.darkElixir)}</b></div>
              </div> : <div className="resources resources-unknown"><strong>{t.resourceUnknown}</strong><span>{t.resourceHint}</span></div>}
              <div className="card-foot"><span>{t.inProgress} <b>{account.upgrades.length}</b></span><span>{t.updated} {relative(account.lastSeen, locale, clockNow)}</span></div>
            </article>;
          })}
          {!accounts.length && <div className="empty villages-empty">{t.noMatches}</div>}
        </section>

        <section className="priority-section">
          <div className="section-title"><div><p className="eyebrow">GROWTH PLAN</p><h2>{t.farmTitle}</h2><p className="section-copy">{t.farmSubtitle}</p></div><span>{farmingPriority.length} {t.accounts}</span></div>
          <div className="priority-list">
            {farmingPriority.slice(0, 8).map(({ account, goldFill, elixirFill, score }, index) => {
              const priority = score >= .55 ? t.farmNow : score >= .3 ? t.farmNext : t.farmSteady;
              const resourceHint = goldFill <= elixirFill ? t.goldLow : t.elixirLow;
              return <article className="priority-item" key={account.id}>
                <div className="rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="priority-name"><span>{priority}</span><h3>{account.name}</h3><p>{resourceHint}{account.builders.free > 0 ? ` · ${t.builderReady} ${account.builders.free}` : ""}</p></div>
                <div className="priority-resource"><span>{t.gold} <b>{Math.round(goldFill * 100)}%</b></span><em><i className="gold-fill" style={{ width: `${goldFill * 100}%` }} /></em></div>
                <div className="priority-resource"><span>{t.elixir} <b>{Math.round(elixirFill * 100)}%</b></span><em><i className="elixir-fill" style={{ width: `${elixirFill * 100}%` }} /></em></div>
                <div className="priority-score"><strong>{Math.round(score * 100)}</strong><span>{locale === "ko" ? "우선도" : "Priority"}</span></div>
              </article>;
            })}
            {!farmingPriority.length && <div className="empty">{t.farmEmpty}</div>}
          </div>
          {!!farmingPriority.length && <p className="heuristic-note">{t.heuristic}</p>}
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
                <div className="timeline"><div><span>{urgency ? t.soon : t.remaining}</span><strong>{remaining(upgrade.finishAt, locale, clockNow)}</strong></div><em><i style={{ width: `${Math.max(12, 88 - index * 13)}%` }} /></em></div>
                <time suppressHydrationWarning>{new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(upgrade.finishAt))}</time>
              </article>;
            })}
            {!allUpgrades.length && <div className="empty">{t.empty}</div>}
          </div>
        </section>
      </div>
      <footer><span>{t.dataStatus} · {demo ? t.awaiting : includesExample ? (locale === "ko" ? "예제" : "Example") : t.normal}</span><span>{t.bark} <b>{t.enabled}</b></span></footer>
    </main>
  );
}
