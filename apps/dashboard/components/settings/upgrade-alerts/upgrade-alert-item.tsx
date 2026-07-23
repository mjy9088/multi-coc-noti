"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { useDashboardFormat } from "../../use-dashboard-format";
import { SettingsFields, SettingsInputField, SettingsSelectField } from "../settings-layout";
import type { Account, Upgrade, UpgradeAlertDraft } from "../settings-model";

export function UpgradeAlertItem({
  account,
  upgrade,
  draft,
  saving,
  clockNow,
  onDraftChange,
  onOpenVillage,
  onSave,
}: {
  account: Account | undefined;
  upgrade: Upgrade;
  draft: UpgradeAlertDraft;
  saving: boolean;
  clockNow: number;
  onDraftChange: (draft: UpgradeAlertDraft) => void;
  onOpenVillage: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("Settings");
  const { formatDateTime, formatDuration } = useDashboardFormat();
  const customMinutesInvalid =
    draft.mode === "custom" && (!Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > 525600);

  return (
    <div className="settings-upgrade-row">
      <div className="settings-upgrade-heading">
        <span>
          <b>
            {account?.label} · {upgrade.name}
          </b>
          <small>
            {formatDateTime(upgrade.finishAt)} ·{" "}
            {t("remainingTime", { time: formatDuration(upgrade.finishAt, clockNow) })} · {t("source_export")}
          </small>
        </span>
        <span className="settings-policy-badge">{t(`resourcePolicy_${account?.resourceStatus || "unanswered"}`)}</span>
      </div>
      <SettingsFields layout="controls">
        <SettingsSelectField
          label={t("preparationAlertSetting")}
          value={draft.mode}
          onChange={(event) => onDraftChange({ ...draft, mode: event.target.value as UpgradeAlertDraft["mode"] })}
        >
          <option value="inherit">
            {t("preparationInherit", { minutes: account?.resourcePreparationMinutes ?? t("disabled") })}
          </option>
          <option value="disabled">{t("preparationDisabled")}</option>
          <option value="custom">{t("preparationCustom")}</option>
        </SettingsSelectField>
        {draft.mode === "custom" && (
          <SettingsInputField
            label={t("resourcePreparationMinutes")}
            type="number"
            min="1"
            max="525600"
            required
            value={draft.minutes}
            onChange={(event) => onDraftChange({ ...draft, minutes: Number(event.target.value) })}
          />
        )}
        <div className="settings-upgrade-actions">
          <Button type="button" tone="secondary" onClick={onOpenVillage}>
            {t("goToVillageSettings")}
          </Button>
          <Button type="button" pending={saving} disabled={saving || customMinutesInvalid} onClick={onSave}>
            {saving ? t("saving") : t("saveNotifications")}
          </Button>
        </div>
      </SettingsFields>
    </div>
  );
}
