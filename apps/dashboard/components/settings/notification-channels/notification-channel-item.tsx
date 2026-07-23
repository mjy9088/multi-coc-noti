"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { NotificationChannel } from "../settings-model";

export function NotificationChannelItem({ channel, onDelete }: { channel: NotificationChannel; onDelete: () => void }) {
  const t = useTranslations("Settings");
  return (
    <div className="settings-upgrade-row">
      <div className="settings-upgrade-heading">
        <span>
          <b>{channel.label}</b>
          <small>{`${channel.baseUrl} · ••••${channel.deviceKeySuffix} · ${channel.locale.toUpperCase()}`}</small>
        </span>
        <Button type="button" tone="danger" onClick={onDelete}>
          {t("delete")}
        </Button>
      </div>
    </div>
  );
}
