"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { SettingsSurface } from "../settings-layout";
import type { ResourceStatus } from "../settings-model";

export function ResourceStatusPrompt({
  pending,
  onResponse,
  onAnswerLater,
}: {
  pending: boolean;
  onResponse: (status: Exclude<ResourceStatus, "unanswered">) => void;
  onAnswerLater: () => void;
}) {
  const t = useTranslations("Settings");
  return (
    <SettingsSurface kind="resource-prompt" aria-live="polite">
      <h2>{t("resourcePromptTitle")}</h2>
      <p>{t("resourcePromptHelp")}</p>
      <div className="resource-dialog-options">
        <Button disabled={pending} onClick={() => onResponse("abundant")}>
          {t("resourceAbundant")}
        </Button>
        <Button disabled={pending} onClick={() => onResponse("sufficient")}>
          {t("resourceSufficient")}
        </Button>
        <Button disabled={pending} onClick={() => onResponse("insufficient")}>
          {t("resourceInsufficient")}
        </Button>
      </div>
      <Button tone="secondary" disabled={pending} onClick={onAnswerLater}>
        {t("resourceAnswerLater")}
      </Button>
    </SettingsSurface>
  );
}
