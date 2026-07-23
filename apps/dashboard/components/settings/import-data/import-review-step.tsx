"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import UpgradeAvailabilityPanel from "../../upgrade-availability-panel";
import { SettingsInputField, SettingsSurface } from "../settings-layout";
import type { ExportPreview } from "../settings-model";
import { ImportPreviewChanges } from "./import-preview-changes";

export function ImportReviewStep({
  preview,
  newLabel,
  importing,
  clockNow,
  confirmImportButton,
  formatDateTime,
  formatDuration,
  onNewLabelChange,
  onClearPreview,
  onSubmitImport,
}: {
  preview: ExportPreview;
  newLabel: string;
  importing: boolean;
  clockNow: number;
  confirmImportButton: RefObject<HTMLButtonElement | null>;
  formatDateTime: (input: Date | string) => string;
  formatDuration: (input: Date | string, reference: number) => string;
  onNewLabelChange: (value: string) => void;
  onClearPreview: () => void;
  onSubmitImport: () => void;
}) {
  const t = useTranslations("Settings");
  return (
    <SettingsSurface kind="preview" step="current" aria-current="step">
      <p className="settings-step-label" data-step-state={t("stepNow")}>
        02 · REVIEW
      </p>
      <div className="settings-preview-heading">
        <div>
          <h2>{preview.account?.label || t("newVillage")}</h2>
          <p>
            {preview.tag} · TH {preview.townHall} · {formatDateTime(preview.exportedAt)}
          </p>
        </div>
        <span className={preview.isNew ? "settings-new-badge" : "settings-match-badge"}>
          {preview.isNew ? t("newBadge") : t("matchedBadge")}
        </span>
      </div>
      <ImportPreviewChanges preview={preview} />
      <div className="settings-preview-stats">
        <div>
          <span>{t("inProgress")}</span>
          <b>{preview.upgrades.length}</b>
        </div>
        <div>
          <span>{t("unknownItems")}</span>
          <b>{preview.unknownDataIds.length}</b>
        </div>
      </div>
      <UpgradeAvailabilityPanel builders={preview.builders} upgradeSlots={preview.upgradeSlots} />
      {preview.isNew && (
        <SettingsInputField
          placement="new-village"
          label={t("displayName")}
          description={t("newVillageHelp")}
          required
          autoFocus
          value={newLabel}
          onChange={(event) => onNewLabelChange(event.target.value)}
          placeholder={t("displayNamePlaceholder")}
        />
      )}
      <div className="settings-preview-upgrades">
        {preview.upgrades.slice(0, 8).map((item) => (
          <div key={item.id}>
            <span>
              <b>{item.name}</b>
              <small>
                Lv. {item.level} → {item.nextLevel}
              </small>
            </span>
            <time>
              {formatDateTime(item.finishAt)}
              <small>{t("remainingTime", { time: formatDuration(item.finishAt, clockNow) })}</small>
            </time>
          </div>
        ))}
        {preview.upgrades.length > 8 && <p>+ {preview.upgrades.length - 8}</p>}
      </div>
      <div className="settings-confirm-row">
        <Button tone="secondary" onClick={onClearPreview}>
          {t("pasteAgain")}
        </Button>
        <Button
          ref={confirmImportButton}
          disabled={importing || (preview.isNew && !newLabel.trim())}
          pending={importing}
          onClick={onSubmitImport}
        >
          {preview.isNew ? t("addAndImport") : t("importVillage")}
        </Button>
      </div>
    </SettingsSurface>
  );
}
