"use client";

import {
  Badge,
  Button,
  DataList,
  DataListItem,
  EmptyState,
  Field,
  Label,
  SectionHeader,
  SectionHeaderContent,
  SectionHeaderDescription,
  SectionHeaderTitle,
  Select,
  StaleNotice,
  Toolbar,
} from "@multi-coc/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { historyQueryKey } from "./query-provider";
import { ErrorState, LoadingState } from "./request-state";
import { useDashboardFormat } from "./use-dashboard-format";

type Village = { id: string; name: string; playerTag: string; color: string };
type HistoryUpgrade = {
  id: string;
  accountId: string;
  name: string;
  type: "building" | "hero" | "pet" | "research";
  base: "home" | "builder";
  level: number;
  nextLevel: number;
  startedAt: string;
  finishAt: string;
  active: boolean;
};
type HistoryResponse = { villages: Village[]; upgrades: HistoryUpgrade[]; nextBefore: string | null };
type Filters = { village: string; base: string; active: string; type: string };

export default function HistoryPanel({
  apiBase,
  initialVillageId = "",
}: {
  apiBase: string;
  initialVillageId?: string;
}) {
  const t = useTranslations("History");
  const { formatDateTime } = useDashboardFormat();
  const [filters, setFilters] = useState<Filters>({ village: initialVillageId, base: "", active: "", type: "" });
  const historyQuery = useInfiniteQuery({
    queryKey: historyQueryKey(apiBase, filters),
    queryFn: async ({ pageParam }) => {
      const query = new URLSearchParams({ limit: "50" });
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      if (pageParam) query.set("before", pageParam);
      const response = await fetch(`${apiBase}/api/upgrades?${query}`, { cache: "no-store", credentials: "include" });
      if (!response.ok) throw new Error((await response.json()).error || t("loadFailed"));
      return response.json() as Promise<HistoryResponse>;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextBefore || undefined,
  });
  const pages = historyQuery.data?.pages || [];
  const villages = pages[0]?.villages || [];
  const upgrades = pages.flatMap((page) => page.upgrades);
  const loading = historyQuery.isPending || historyQuery.isFetchingNextPage;
  const error = historyQuery.error instanceof Error ? historyQuery.error.message : "";
  const setFilter = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const villageById = new Map(villages.map((village) => [village.id, village]));
  const labels = {
    building: t("building"),
    hero: t("hero"),
    pet: t("pet"),
    research: t("research"),
  };

  return (
    <section className="history-section">
      <SectionHeader className="history-section-header">
        <SectionHeaderContent>
          <p className="eyebrow">UPGRADE HISTORY</p>
          <SectionHeaderTitle>{t("title")}</SectionHeaderTitle>
          <SectionHeaderDescription>{t("description")}</SectionHeaderDescription>
        </SectionHeaderContent>
      </SectionHeader>
      <Toolbar className="history-filters">
        <Field>
          <Label>{t("village")}</Label>
          <Select value={filters.village} onChange={(event) => setFilter("village", event.target.value)}>
            <option value="">{t("allVillages")}</option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>
                {village.name} · {village.playerTag}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>{t("base")}</Label>
          <Select value={filters.base} onChange={(event) => setFilter("base", event.target.value)}>
            <option value="">{t("all")}</option>
            <option value="home">{t("home")}</option>
            <option value="builder">{t("builderBase")}</option>
          </Select>
        </Field>
        <Field>
          <Label>{t("status")}</Label>
          <Select value={filters.active} onChange={(event) => setFilter("active", event.target.value)}>
            <option value="">{t("all")}</option>
            <option value="true">{t("active")}</option>
            <option value="false">{t("inactive")}</option>
          </Select>
        </Field>
        <Field>
          <Label>{t("type")}</Label>
          <Select value={filters.type} onChange={(event) => setFilter("type", event.target.value)}>
            <option value="">{t("all")}</option>
            <option value="building">{t("building")}</option>
            <option value="hero">{t("hero")}</option>
            <option value="pet">{t("pet")}</option>
            <option value="research">{t("research")}</option>
          </Select>
        </Field>
      </Toolbar>
      {error && upgrades.length > 0 && (
        <StaleNotice onRetry={() => void historyQuery.refetch()} retryLabel={t("retry")}>
          {error}
        </StaleNotice>
      )}
      {error && !upgrades.length && <ErrorState compact message={error} retry={() => void historyQuery.refetch()} />}
      <DataList className="history-list">
        {upgrades.map((upgrade) => {
          const village = villageById.get(upgrade.accountId);
          return (
            <DataListItem
              className="history-card"
              key={upgrade.id}
              style={{ "--accent": village?.color || "var(--ui-color-accent)" } as React.CSSProperties}
            >
              <i className={`history-type ${upgrade.type}`} />
              <div>
                <span>
                  {village?.name || upgrade.accountId} · {labels[upgrade.type]}
                </span>
                <h2>{upgrade.name}</h2>
                <p>
                  {upgrade.base === "builder" ? t("builderBase") : t("home")} ·{" "}
                  {t("level", { from: upgrade.level, to: upgrade.nextLevel })}
                </p>
              </div>
              <div className="history-result">
                <Badge tone={upgrade.active ? "accent" : "neutral"}>{t(upgrade.active ? "active" : "inactive")}</Badge>
                <time>{formatDateTime(upgrade.finishAt)}</time>
              </div>
            </DataListItem>
          );
        })}
        {!loading && !upgrades.length && <EmptyState title={t("empty")} />}
      </DataList>
      {historyQuery.hasNextPage && (
        <Button className="history-more" pending={loading} onClick={() => void historyQuery.fetchNextPage()}>
          {loading ? t("loading") : t("loadMore")}
        </Button>
      )}
      {loading && !upgrades.length && <LoadingState compact />}
    </section>
  );
}
