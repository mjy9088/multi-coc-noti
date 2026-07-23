"use client";

import { Button, RequestState, Spinner } from "@multi-coc/ui";
import { useTranslations } from "next-intl";

export function LoadingState({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("RequestState");
  return (
    <RequestState
      className={compact ? "dashboard-request-state" : "dashboard-request-state shell"}
      title={t("loading")}
      description={t("loadingHelp")}
      action={<Spinner label={t("loading")} />}
      aria-live="polite"
      aria-busy="true"
    />
  );
}

export function ErrorState({
  message,
  retry,
  compact = false,
}: {
  message?: string;
  retry: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("RequestState");
  return (
    <RequestState
      className={compact ? "dashboard-request-state" : "dashboard-request-state shell"}
      tone="error"
      title={t("failed")}
      description={message || t("failedHelp")}
      action={<Button onClick={retry}>{t("retry")}</Button>}
    />
  );
}
