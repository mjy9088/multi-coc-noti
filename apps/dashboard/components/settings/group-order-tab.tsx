"use client";

import { Button } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { SettingsSurface } from "./settings-layout";

export function GroupOrderTab({
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
