"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { useDashboardFormat } from "../../app/use-dashboard-format";
import { SettingsFields, SettingsInputField, SettingsSelectField, SettingsSurface } from "./settings-layout";
import type { Account, BarkChannelForm, NotificationChannel, Upgrade, UpgradeAlertDraft } from "./settings-model";

export function NotificationChannelsSettings({
  channels,
  form,
  setForm,
  onDelete,
  onSubmit,
}: {
  channels: NotificationChannel[];
  form: BarkChannelForm;
  setForm: Dispatch<SetStateAction<BarkChannelForm>>;
  onDelete: (channel: NotificationChannel) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const t = useTranslations("Settings");
  return (
    <SettingsSurface kind="channels">
      <h2>{t("barkChannels")}</h2>
      <p>{t("barkChannelsHelp")}</p>
      <div className="settings-upgrade-list">
        {channels.map((channel) => (
          <div className="settings-upgrade-row" key={channel.id}>
            <div className="settings-upgrade-heading">
              <span>
                <b>{channel.label}</b>
                <small>{`${channel.baseUrl} · ••••${channel.deviceKeySuffix} · ${channel.locale.toUpperCase()}`}</small>
              </span>
              <Button type="button" tone="danger" onClick={() => onDelete(channel)}>
                {t("delete")}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <SettingsFields as="form" layout="controls" onSubmit={onSubmit}>
        <SettingsInputField
          label={t("channelName")}
          required
          value={form.label}
          onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
        />
        <SettingsInputField
          label={t("barkDeviceKey")}
          required
          type="password"
          autoComplete="off"
          value={form.deviceKey}
          onChange={(event) => setForm((current) => ({ ...current, deviceKey: event.target.value }))}
        />
        <SettingsSelectField
          label={t("notificationLanguage")}
          value={form.locale}
          onChange={(event) =>
            setForm((current) => ({ ...current, locale: event.target.value === "en" ? "en" : "ko" }))
          }
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </SettingsSelectField>
        <Button type="submit">{t("addNotificationChannel")}</Button>
      </SettingsFields>
    </SettingsSurface>
  );
}

export function UpgradeAlertSettings({
  accounts,
  upgrades,
  drafts,
  setDrafts,
  savingUpgradeId,
  clockNow,
  onOpenVillage,
  onSave,
}: {
  accounts: Account[];
  upgrades: Upgrade[];
  drafts: Record<string, UpgradeAlertDraft>;
  setDrafts: Dispatch<SetStateAction<Record<string, UpgradeAlertDraft>>>;
  savingUpgradeId: string | null;
  clockNow: number;
  onOpenVillage: (account: Account | undefined) => void;
  onSave: (upgrade: Upgrade) => void;
}) {
  const t = useTranslations("Settings");
  const { formatDateTime, formatDuration } = useDashboardFormat();
  const activeUpgrades = upgrades.filter((item) => item.status === "active");
  return (
    <SettingsSurface kind="upgrades">
      <h2>{t("upgradeAlertsTitle")}</h2>
      <p>{t("upgradeAlertsHelp")}</p>
      <div className="settings-upgrade-list">
        {activeUpgrades.length ? (
          activeUpgrades.map((item) => {
            const account = accounts.find((candidate) => candidate.id === item.accountId);
            const draft = drafts[item.id] || { mode: "inherit", minutes: 60 };
            return (
              <div className="settings-upgrade-row" key={item.id}>
                <div className="settings-upgrade-heading">
                  <span>
                    <b>
                      {account?.label} · {item.name}
                    </b>
                    <small>
                      {formatDateTime(item.finishAt)} ·{" "}
                      {t("remainingTime", { time: formatDuration(item.finishAt, clockNow) })} · {t("source_export")}
                    </small>
                  </span>
                  <span className="settings-policy-badge">
                    {t(`resourcePolicy_${account?.resourceStatus || "unanswered"}`)}
                  </span>
                </div>
                <SettingsFields layout="controls">
                  <SettingsSelectField
                    label={t("preparationAlertSetting")}
                    value={draft.mode}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [item.id]: { ...draft, mode: event.target.value as UpgradeAlertDraft["mode"] },
                      }))
                    }
                  >
                    <option value="inherit">
                      {t("preparationInherit", {
                        minutes: account?.resourcePreparationMinutes ?? t("disabled"),
                      })}
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
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [item.id]: { ...draft, minutes: Number(event.target.value) },
                        }))
                      }
                    />
                  )}
                  <div className="settings-upgrade-actions">
                    <Button type="button" tone="secondary" onClick={() => onOpenVillage(account)}>
                      {t("goToVillageSettings")}
                    </Button>
                    <Button
                      type="button"
                      pending={savingUpgradeId === item.id}
                      disabled={
                        savingUpgradeId === item.id ||
                        (draft.mode === "custom" &&
                          (!Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > 525600))
                      }
                      onClick={() => onSave(item)}
                    >
                      {savingUpgradeId === item.id ? t("saving") : t("saveNotifications")}
                    </Button>
                  </div>
                </SettingsFields>
              </div>
            );
          })
        ) : (
          <p>{t("noTrackedUpgrades")}</p>
        )}
      </div>
    </SettingsSurface>
  );
}

export function GroupOrderSettings({
  groups,
  onMove,
}: {
  groups: string[];
  onMove: (index: number, offset: -1 | 1) => void;
}) {
  const t = useTranslations("Settings");
  return (
    <SettingsSurface kind="groups">
      <h2>{t("groupOrder")}</h2>
      <p>{t("groupOrderHelp")}</p>
      <div className="settings-group-list">
        {groups.map((tag, index) => (
          <div key={tag}>
            <span>#{tag}</span>
            <span>
              <Button
                type="button"
                size="small"
                tone="secondary"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                aria-label={t("moveGroupUp", { tag })}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="small"
                tone="secondary"
                disabled={index === groups.length - 1}
                onClick={() => onMove(index, 1)}
                aria-label={t("moveGroupDown", { tag })}
              >
                ↓
              </Button>
            </span>
          </div>
        ))}
        {!groups.length && <small>{t("noGroups")}</small>}
      </div>
    </SettingsSurface>
  );
}
