"use client";

import { Button, EmptyState, SelectField, StaleNotice } from "@multi-coc/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { syncHistoryQueryKey } from "../query-provider";
import { ErrorState, LoadingState } from "../request-state";
import { useDashboardFormat } from "../use-dashboard-format";
import { HistoryFilters, HistoryResults, HistorySection } from "./history-layout";
import type { HistoryVillage, SyncEntry } from "./history-model";
import { SyncHistoryItem } from "./sync-history-item";

type SyncResponse = { villages: HistoryVillage[]; syncs: SyncEntry[]; nextBefore: string | null };

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
        {syncs.map((sync) => (
          <SyncHistoryItem
            key={sync.id}
            sync={sync}
            village={villageById.get(sync.accountId)}
            formatDateTime={formatDateTime}
          />
        ))}
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
