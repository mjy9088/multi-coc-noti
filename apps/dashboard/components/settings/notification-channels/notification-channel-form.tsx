"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { SettingsFields, SettingsInputField, SettingsSelectField } from "../settings-layout";
import type { BarkChannelForm } from "../settings-model";

export function NotificationChannelForm({
  form,
  setForm,
  onSubmit,
}: {
  form: BarkChannelForm;
  setForm: Dispatch<SetStateAction<BarkChannelForm>>;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const t = useTranslations("Settings");
  return (
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
        onChange={(event) => setForm((current) => ({ ...current, locale: event.target.value === "en" ? "en" : "ko" }))}
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
      </SettingsSelectField>
      <Button type="submit">{t("addNotificationChannel")}</Button>
    </SettingsFields>
  );
}
