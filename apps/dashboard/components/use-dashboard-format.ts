"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";

export function useDashboardFormat() {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("Dashboard");
  return {
    locale,
    formatDateTime: (input: Date | string) =>
      format.dateTime(new Date(input), { dateStyle: "medium", timeStyle: "short" }),
    formatQueueDate: (input: Date | string) =>
      format.dateTime(new Date(input), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    formatRelative: (input: Date | string, reference: number) =>
      format.relativeTime(new Date(input), new Date(reference)),
    formatDuration: (input: Date | string, reference: number) => {
      const milliseconds = Math.max(0, new Date(input).getTime() - reference);
      if (milliseconds < 60_000) return t("underMinute");
      const days = Math.floor(milliseconds / 86_400_000);
      const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
      const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
      const parts: Array<[number, "day" | "hour" | "minute"]> = days
        ? [
            [days, "day"],
            [hours, "hour"],
          ]
        : hours
          ? [
              [hours, "hour"],
              [minutes, "minute"],
            ]
          : [[minutes, "minute"]];
      return parts
        .map(([amount, unit]) => format.number(amount, { style: "unit", unit, unitDisplay: "narrow" }))
        .join(" ");
    },
    lowerCase: (text: string) => text.toLocaleLowerCase(locale),
  };
}
