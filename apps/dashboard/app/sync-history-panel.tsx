"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import HistoryNav from "./history-nav";
import { syncHistoryQueryKey } from "./query-provider";
import { ErrorState, LoadingState } from "./request-state";
import { useDashboardFormat } from "./use-dashboard-format";

type Village = { id: string; name: string; playerTag: string; color: string };
type SyncEntry = {
  id: string;
  accountId: string;
  playerTag: string;
  exportedAt: string;
  importedAt: string;
  townHall: number;
  upgrades: number;
  homeUpgrades: number;
  builderUpgrades: number;
  builders: { free: number; total: number };
  unknownDataIds: number;
};
type SyncResponse = { villages: Village[]; syncs: SyncEntry[]; nextBefore: string | null };

export default function SyncHistoryPanel({ apiBase }: { apiBase: string }) {
  const t = useTranslations("History");
  const { formatDateTime } = useDashboardFormat();
  const [village, setVillage] = useState("");
  const syncQuery = useInfiniteQuery({
    queryKey: syncHistoryQueryKey(apiBase, village),
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({ limit: "50" });
      if (village) query.set("village", village);
      if (pageParam) query.set("before", pageParam);
      const response = await fetch(`${apiBase}/api/syncs?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error || t("syncLoadFailed"));
      return response.json() as Promise<SyncResponse>;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextBefore || undefined,
  });
  const pages = syncQuery.data?.pages || [];
  const villages = pages[0]?.villages || [];
  const syncs = pages.flatMap((page) => page.syncs);
  const villageById = new Map(villages.map((item) => [item.id, item]));
  const loading = syncQuery.isPending || syncQuery.isFetchingNextPage;
  const error = syncQuery.error instanceof Error ? syncQuery.error.message : "";

  return (
    <section className="history-shell shell">
      <HistoryNav section="syncs" />
      <header className="history-section-header">
        <p className="eyebrow">SYNC HISTORY</p>
        <h2>{t("syncTitle")}</h2>
        <p>{t("syncDescription")}</p>
      </header>
      <div className="history-filters sync-history-filters">
        <label>
          {t("village")}
          <select value={village} onChange={(event) => setVillage(event.target.value)}>
            <option value="">{t("allVillages")}</option>
            {villages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.playerTag}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && syncs.length > 0 && (
        <div className="stale-warning" role="status">
          {error}
          <button onClick={() => void syncQuery.refetch()}>{t("retry")}</button>
        </div>
      )}
      {error && !syncs.length && <ErrorState compact message={error} retry={() => void syncQuery.refetch()} />}
      <div className="history-list sync-history-list">
        {syncs.map((sync) => {
          const account = villageById.get(sync.accountId);
          return (
            <article key={sync.id} style={{ "--accent": account?.color || "#9a7c4c" } as React.CSSProperties}>
              <i className="history-type sync" />
              <div>
                <span>{account?.name || sync.playerTag}</span>
                <h2>{t("syncSummary", { townHall: sync.townHall, upgrades: sync.upgrades })}</h2>
                <p>
                  {t("syncDetails", {
                    home: sync.homeUpgrades,
                    builder: sync.builderUpgrades,
                    free: sync.builders.free,
                    total: sync.builders.total,
                  })}
                </p>
                {sync.unknownDataIds > 0 && <small>{t("unknownData", { count: sync.unknownDataIds })}</small>}
              </div>
              <div className="history-result">
                <b className="history-status active">{t("synced")}</b>
                <time>{formatDateTime(sync.importedAt)}</time>
                <small>{t("exportedAt", { date: formatDateTime(sync.exportedAt) })}</small>
              </div>
            </article>
          );
        })}
        {!loading && !syncs.length && <div className="empty">{t("syncEmpty")}</div>}
      </div>
      {syncQuery.hasNextPage && (
        <button className="history-more" disabled={loading} onClick={() => void syncQuery.fetchNextPage()}>
          {loading ? t("loading") : t("loadMore")}
        </button>
      )}
      {loading && !syncs.length && <LoadingState compact />}
    </section>
  );
}
