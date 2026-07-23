"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { SettingsSurface, SettingsTextareaField } from "../settings-layout";

export function ImportPasteStep({
  complete,
  exportText,
  previewLoading,
  onExportTextChange,
  onPasteClipboard,
  onReview,
}: {
  complete: boolean;
  exportText: string;
  previewLoading: boolean;
  onExportTextChange: (value: string) => void;
  onPasteClipboard: () => void;
  onReview: () => void;
}) {
  const t = useTranslations("Settings");
  return (
    <SettingsSurface
      kind="import"
      step={complete ? "complete" : "current"}
      aria-current={!complete ? "step" : undefined}
    >
      <p className="settings-step-label" data-step-state={complete ? t("stepDone") : t("stepNow")}>
        01 · PASTE
      </p>
      <h2>{t("pasteJson")}</h2>
      <p>{t("pasteJsonHelp")}</p>
      <SettingsTextareaField
        label={t("pasteJson")}
        labelVisibility="hidden"
        value={exportText}
        onChange={(event) => onExportTextChange(event.target.value)}
        placeholder='{"tag":"#...","timestamp":...}'
        autoFocus
        spellCheck={false}
        autoCapitalize="off"
        aria-busy={previewLoading}
      />
      <div className="settings-review-action" aria-live="polite">
        <small>{previewLoading ? t("reviewingData") : t("autoReviewHelp")}</small>
        <span>
          <Button type="button" tone="secondary" onClick={onPasteClipboard}>
            {t("pasteClipboard")}
          </Button>
          <Button
            type="button"
            disabled={!exportText.trim() || previewLoading}
            pending={previewLoading}
            onClick={onReview}
          >
            {previewLoading ? t("reviewingData") : t("reviewData")}
          </Button>
        </span>
      </div>
    </SettingsSurface>
  );
}
