"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localeCookie, normalizeLocale } from "./i18n-config";
import type { Locale } from "./i18n-config";
export { locales } from "./i18n-config";
export type { Locale } from "./i18n-config";

const messages = {
  "ko-KR": {
    dashboard: "대시보드", history: "히스토리", settings: "알림 설정", demo: "데모 데이터", synced: "마지막 동기화", exampleIncluded: "예제 데이터 포함", example: "예제", eyebrow: "VILLAGE OVERVIEW", title: "오늘의 마을 현황", subtitle: "모든 계정의 빌더와 연구 진행 상황을 한곳에서 확인하세요.", accounts: "운영 계정", builders: "대기 빌더", earliest: "가장 빠른 완료", none: "없음", all: "전체 계정", normal: "정상", delayed: "지연", builder: "빌더", inProgress: "진행 중", updated: "업데이트", queue: "완료 예정 업그레이드", soonest: "빠른 순서", soon: "곧 완료", remaining: "남은 시간", underMinute: "1분 미만", empty: "진행 중인 업그레이드가 없습니다.", dataStatus: "JSONL 수집 상태", awaiting: "연결 대기 중", bark: "Bark 알림", enabled: "활성", building: "건물", hero: "영웅", pet: "펫", research: "연구소", level: "레벨", gold: "골드", elixir: "엘릭서", dark: "다크 엘릭서", search: "계정 이름·태그 검색", statusAll: "모든 상태", freeOnly: "대기 빌더 있음", delayedOnly: "동기화 지연", noMatches: "조건에 맞는 계정이 없습니다.", resourceUnknown: "자원 정보 없음", resourceHint: "게임 export에는 현재 보유 자원이 없습니다. 상태 서버 데이터가 연결되면 표시됩니다.", farmEmpty: "자원 데이터를 제공한 마을이 없어 우선순위를 계산하지 않았습니다.", farmTitle: "파밍 우선순위", farmSubtitle: "자원 부족률과 대기 빌더를 기준으로 지금 돌볼 마을을 정렬했습니다.", heuristic: "계획 중인 업그레이드 비용이 연결되기 전까지 골드·엘릭서 부족률 75%, 대기 빌더 비율 25%로 계산합니다.", farmNow: "지금 파밍", farmNext: "다음 순서", farmSteady: "여유", goldLow: "골드 우선", elixirLow: "엘릭서 우선", builderReady: "빌더 대기", priority: "우선도", displayOptions: "표시 옵션", inferGoblinResearcher: "고블린 연구원 여유 슬롯 추정", inferGoblinBuilder: "고블린 장인 여유 슬롯 추정",
    availabilityTitle: "업그레이드 가능 상태", availabilityBuilder: "빌더", availabilityResearch: "연구소", availabilityPet: "펫", availabilityBuilderBaseBuilder: "장인기지 장인", availabilityBuilderBaseLab: "장인기지 연구소", available: "업그레이드 가능", busy: "진행 중", researching: "연구 중", goblinResearcher: "고블린 연구원 포함", goblinResearcherReady: "고블린 연구원 사용 가능", goblinBuilderReady: "고블린 장인 사용 가능", goblinBuilderActive: "고블린 장인 포함",
  },
  "en-US": {
    dashboard: "Dashboard", history: "History", settings: "Alerts", demo: "Demo data", synced: "Last sync", exampleIncluded: "Includes example data", example: "Example", eyebrow: "VILLAGE OVERVIEW", title: "Village status today", subtitle: "Track builders, research, and resources across every account.", accounts: "Accounts", builders: "Free builders", earliest: "Next completion", none: "None", all: "All accounts", normal: "Live", delayed: "Delayed", builder: "Builders", inProgress: "In progress", updated: "Updated", queue: "Upcoming completions", soonest: "Soonest first", soon: "Finishing soon", remaining: "Time left", underMinute: "Under 1m", empty: "No upgrades are currently running.", dataStatus: "JSONL collector", awaiting: "Awaiting connection", bark: "Bark alerts", enabled: "On", building: "Building", hero: "Hero", pet: "Pet", research: "Laboratory", level: "Level", gold: "Gold", elixir: "Elixir", dark: "Dark Elixir", search: "Search name or tag", statusAll: "All statuses", freeOnly: "Builder available", delayedOnly: "Sync delayed", noMatches: "No accounts match these filters.", resourceUnknown: "Resources unavailable", resourceHint: "Game exports do not include current resources. They appear after a status source is connected.", farmEmpty: "Farming priority is unavailable because no village has resource data.", farmTitle: "Farming priority", farmSubtitle: "Villages are ranked by resource shortage and available builders.", heuristic: "Until planned upgrade costs are connected, the score uses 75% gold/elixir shortage and 25% free-builder ratio.", farmNow: "Farm now", farmNext: "Up next", farmSteady: "Steady", goldLow: "Prioritize gold", elixirLow: "Prioritize elixir", builderReady: "Builder ready", priority: "Priority", displayOptions: "Display options", inferGoblinResearcher: "Infer Goblin Researcher availability", inferGoblinBuilder: "Infer Goblin Builder availability",
    availabilityTitle: "Upgrade availability", availabilityBuilder: "Builders", availabilityResearch: "Laboratory", availabilityPet: "Pet", availabilityBuilderBaseBuilder: "Builder Base builders", availabilityBuilderBaseLab: "Builder Base lab", available: "Upgrade available", busy: "In progress", researching: "researching", goblinResearcher: "includes Goblin Researcher", goblinResearcherReady: "Goblin Researcher available", goblinBuilderReady: "Goblin Builder available", goblinBuilderActive: "includes Goblin Builder",
  },
} as const;

export type MessageKey = keyof (typeof messages)["ko-KR"];

type I18nValue = {
  locale: Locale;
  isKorean: boolean;
  messages: (typeof messages)[Locale];
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
  formatDateTime: (value: Date | string) => string;
  formatQueueDate: (value: Date | string) => string;
  formatRelative: (value: Date | string, reference: number) => string;
  formatDuration: (value: Date | string, reference: number) => string;
  formatCompactNumber: (value: number) => string;
  lowerCase: (value: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    localStorage.setItem(localeCookie, next);
  }, []);

  useEffect(() => {
    // Migrate the former localStorage-only `ko`/`en` setting to the server-readable cookie.
    if (document.cookie.split("; ").some((item) => item.startsWith(`${localeCookie}=`))) return;
    const legacyLocale = localStorage.getItem(localeCookie);
    if (!legacyLocale) return;
    const timer = window.setTimeout(() => setLocale(normalizeLocale(legacyLocale)), 0);
    return () => window.clearTimeout(timer);
  }, [setLocale]);

  const value = useMemo<I18nValue>(() => {
    const t = (key: MessageKey) => messages[locale][key];
    const relativeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
    const unitFormatter = (unit: "day" | "hour" | "minute") => new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" });
    return {
      locale,
      isKorean: locale === "ko-KR",
      messages: messages[locale],
      setLocale,
      t,
      formatDateTime: (input) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(input)),
      formatQueueDate: (input) => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(input)),
      formatRelative: (input, reference) => {
        const minutes = Math.max(0, Math.round((reference - new Date(input).getTime()) / 60_000));
        return minutes < 60 ? relativeFormatter.format(-minutes, "minute") : relativeFormatter.format(-Math.floor(minutes / 60), "hour");
      },
      formatDuration: (input, reference) => {
        const milliseconds = Math.max(0, new Date(input).getTime() - reference);
        if (milliseconds < 60_000) return t("underMinute");
        const days = Math.floor(milliseconds / 86_400_000);
        const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
        const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
        const parts = days ? [[days, "day"], [hours, "hour"]] : hours ? [[hours, "hour"], [minutes, "minute"]] : [[minutes, "minute"]];
        return parts.map(([amount, unit]) => unitFormatter(unit as "day" | "hour" | "minute").format(amount as number)).join(" ");
      },
      formatCompactNumber: (number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(number),
      lowerCase: (text) => text.toLocaleLowerCase(locale),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
