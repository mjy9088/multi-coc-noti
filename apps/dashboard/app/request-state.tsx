"use client";

import { useTranslations } from "next-intl";

export function LoadingState({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("RequestState");
  return <section className={compact ? "request-state compact" : "request-state shell"} aria-live="polite" aria-busy="true">
    <div className="loading-spinner" aria-hidden="true" /><h1>{t("loading")}</h1><p>{t("loadingHelp")}</p>
  </section>;
}

export function ErrorState({ message, retry, compact = false }: { message?: string; retry: () => void; compact?: boolean }) {
  const t = useTranslations("RequestState");
  return <section className={compact ? "request-state error compact" : "request-state error shell"} role="alert">
    <span aria-hidden="true">!</span><h1>{t("failed")}</h1><p>{message || t("failedHelp")}</p><button type="button" onClick={retry}>{t("retry")}</button>
  </section>;
}
