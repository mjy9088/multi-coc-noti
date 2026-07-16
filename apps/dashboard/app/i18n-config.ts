export const locales = ["ko-KR", "en-US"] as const;
export type Locale = (typeof locales)[number];
export const localeCookie = "multi-village-locale";

export function normalizeLocale(value?: string | null): Locale {
  if (value?.toLowerCase().startsWith("en")) return "en-US";
  return "ko-KR";
}
