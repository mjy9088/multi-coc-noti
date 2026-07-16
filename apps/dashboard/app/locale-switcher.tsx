"use client";

import { useCallback, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { localeCookie, localeLabels, locales, normalizeLocale } from "./i18n-config";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("Dashboard");
  const router = useRouter();

  const changeLocale = useCallback((next: (typeof locales)[number]) => {
    document.documentElement.lang = next;
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    localStorage.setItem(localeCookie, next);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (document.cookie.split("; ").some((item) => item.startsWith(`${localeCookie}=`))) return;
    const legacyLocale = localStorage.getItem(localeCookie);
    if (!legacyLocale) return;
    const timer = window.setTimeout(() => changeLocale(normalizeLocale(legacyLocale)), 0);
    return () => window.clearTimeout(timer);
  }, [changeLocale]);

  return <div className="locale-toggle" aria-label={t("language")}>{locales.map((option) => <button type="button" key={option} className={locale === option ? "selected" : ""} aria-pressed={locale === option} onClick={() => changeLocale(option)} lang={option}>{localeLabels[option]}</button>)}</div>;
}
