"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useDashboardFormat } from "./use-dashboard-format";
import { ErrorState, LoadingState } from "./request-state";

type Village = { id: string; name: string; playerTag: string; color: string };
type HistoryUpgrade = {
  id: string; accountId: string; name: string; type: "building" | "hero" | "pet" | "research";
  base: "home" | "builder"; level: number; nextLevel: number; startedAt: string; finishAt: string;
  status: "active" | "completed" | "cancelled";
};
type HistoryResponse = { villages: Village[]; upgrades: HistoryUpgrade[]; nextBefore: string | null };
type Filters = { village: string; base: string; status: string; type: string };

export default function HistoryPanel({ apiBase, initialVillageId = "" }: { apiBase: string; initialVillageId?: string }) {
  const t = useTranslations("History");
  const { formatDateTime } = useDashboardFormat();
  const [filters, setFilters] = useState<Filters>({ village: initialVillageId, base: "", status: "", type: "" });
  const [villages, setVillages] = useState<Village[]>([]);
  const [upgrades, setUpgrades] = useState<HistoryUpgrade[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (before?: string) => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ limit: "50" });
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      if (before) query.set("before", before);
      const response = await fetch(`${apiBase}/api/upgrades?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error || t("loadFailed"));
      const result = await response.json() as HistoryResponse;
      setVillages(result.villages);
      setUpgrades((current) => before ? [...current, ...result.upgrades] : result.upgrades);
      setNextBefore(result.nextBefore);
    } catch (failure) { setError((failure as Error).message || t("loadFailed")); }
    finally { setLoading(false); }
  }, [apiBase, filters, t]);

  useEffect(() => { void load(); }, [load]);
  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const villageById = new Map(villages.map((village) => [village.id, village]));
  const labels = {
    building: t("building"), hero: t("hero"), pet: t("pet"), research: t("research"),
    active: t("active"), completed: t("completed"), cancelled: t("cancelled"),
  };

  return <section className="history-shell shell">
    <header className="history-header"><p className="eyebrow">UPGRADE HISTORY</p><h1>{t("title")}</h1><p>{t("description")}</p></header>
    <div className="history-filters">
      <label>{t("village")}<select value={filters.village} onChange={(event) => setFilter("village", event.target.value)}><option value="">{t("allVillages")}</option>{villages.map((village) => <option key={village.id} value={village.id}>{village.name} · {village.playerTag}</option>)}</select></label>
      <label>{t("base")}<select value={filters.base} onChange={(event) => setFilter("base", event.target.value)}><option value="">{t("all")}</option><option value="home">{t("home")}</option><option value="builder">{t("builderBase")}</option></select></label>
      <label>{t("status")}<select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}><option value="">{t("all")}</option><option value="active">{t("active")}</option><option value="completed">{t("completed")}</option><option value="cancelled">{t("cancelled")}</option></select></label>
      <label>{t("type")}<select value={filters.type} onChange={(event) => setFilter("type", event.target.value)}><option value="">{t("all")}</option><option value="building">{t("building")}</option><option value="hero">{t("hero")}</option><option value="pet">{t("pet")}</option><option value="research">{t("research")}</option></select></label>
    </div>
    {error && upgrades.length > 0 && <div className="stale-warning" role="status">{error}<button onClick={() => void load()}>{t("retry")}</button></div>}
    {error && !upgrades.length && <ErrorState compact message={error} retry={() => void load()} />}
    <div className="history-list">
      {upgrades.map((upgrade) => {
        const village = villageById.get(upgrade.accountId);
        return <article key={upgrade.id} style={{ "--accent": village?.color || "#9a7c4c" } as React.CSSProperties}>
          <i className={`history-type ${upgrade.type}`} />
          <div><span>{village?.name || upgrade.accountId} · {labels[upgrade.type]}</span><h2>{upgrade.name}</h2><p>{upgrade.base === "builder" ? t("builderBase") : t("home")} · {t("level", { from: upgrade.level, to: upgrade.nextLevel })}</p></div>
          <div className="history-result"><b className={`history-status ${upgrade.status}`}>{labels[upgrade.status]}</b><time>{formatDateTime(upgrade.finishAt)}</time></div>
        </article>;
      })}
      {!loading && !upgrades.length && <div className="empty">{t("empty")}</div>}
    </div>
    {nextBefore && <button className="history-more" disabled={loading} onClick={() => void load(nextBefore)}>{loading ? t("loading") : t("loadMore")}</button>}
    {loading && !upgrades.length && <LoadingState compact />}
  </section>;
}
