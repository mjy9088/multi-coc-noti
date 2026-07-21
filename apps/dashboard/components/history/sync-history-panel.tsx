"use client";

import { Badge, Button, DataListItem, EmptyState, SelectField, StaleNotice } from "@multi-coc/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { syncHistoryQueryKey } from "../../app/query-provider";
import { ErrorState, LoadingState } from "../../app/request-state";
import { useDashboardFormat } from "../../app/use-dashboard-format";
import { HistoryFilters, HistoryResults, HistorySection } from "./history-layout";

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
      const response = await fetch(`${apiBase}/api/syncs?${query}`, { cache: "no-store", credentials: "include" });
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
    <HistorySection eyebrow="SYNC HISTORY" title={t("syncTitle")} description={t("syncDescription")}>
      <HistoryFilters size="single">
        <SelectField label={t("village")} value={village} onChange={(event) => setVillage(event.target.value)}>
          <option value="">{t("allVillages")}</option>
          {villages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.playerTag}
            </option>
          ))}
        </SelectField>
      </HistoryFilters>
      {error && syncs.length > 0 && (
        <StaleNotice onRetry={() => void syncQuery.refetch()} retryLabel={t("retry")}>
          {error}
        </StaleNotice>
      )}
      {error && !syncs.length && <ErrorState compact message={error} retry={() => void syncQuery.refetch()} />}
      <HistoryResults kind="syncs">
        {syncs.map((sync) => {
          const account = villageById.get(sync.accountId);
          return (
            <DataListItem
              className="history-card"
              key={sync.id}
              style={{ "--accent": account?.color || "var(--ui-color-accent)" } as React.CSSProperties}
            >
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
                <Badge tone="success">{t("synced")}</Badge>
                <time>{formatDateTime(sync.importedAt)}</time>
                <small>{t("exportedAt", { date: formatDateTime(sync.exportedAt) })}</small>
              </div>
            </DataListItem>
          );
        })}
        {!loading && !syncs.length && <EmptyState title={t("syncEmpty")} />}
      </HistoryResults>
      {syncQuery.hasNextPage && (
        <Button className="history-more" pending={loading} onClick={() => void syncQuery.fetchNextPage()}>
          {loading ? t("loading") : t("loadMore")}
        </Button>
      )}
      {loading && !syncs.length && <LoadingState compact />}
    </HistorySection>
  );
}
