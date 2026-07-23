"use client";

import { useTranslations } from "next-intl";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { SettingsSurface } from "../settings-layout";
import type { BarkChannelForm, NotificationChannel } from "../settings-model";
import { NotificationChannelForm } from "./notification-channel-form";
import { NotificationChannelItem } from "./notification-channel-item";

export function NotificationChannelsTab({
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
          <NotificationChannelItem key={channel.id} channel={channel} onDelete={() => onDelete(channel)} />
        ))}
      </div>
      <NotificationChannelForm form={form} setForm={setForm} onSubmit={onSubmit} />
    </SettingsSurface>
  );
}
