import type { Locale } from "./i18n-config";

export async function loadMessages(locale: Locale) {
  return (await import(`../messages/${locale}.json`)).default;
}
