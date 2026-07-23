"use client";

import { useTranslations } from "next-intl";
import type { ExportPreview } from "../settings-model";

export function ImportPreviewChanges({ preview }: { preview: ExportPreview }) {
  const t = useTranslations("Settings");
  const noChanges = !preview.changes.started.length && !preview.changes.ended.length && !preview.changes.slots.length;
  return (
    <section className="settings-preview-changes" aria-live="polite">
      <h3>{t("changesTitle")}</h3>
      {!preview.changes.hasPrevious ? (
        <p>{t("changesFirstExport")}</p>
      ) : noChanges ? (
        <p>{t("changesNone")}</p>
      ) : (
        <>
          {!!preview.changes.started.length && (
            <ChangeGroup
              tone="started"
              title={t("changesStarted")}
              items={preview.changes.started.map((item) => ({
                key: item.id,
                text: `+ ${item.name}`,
                detail: `Lv. ${item.level} → ${item.nextLevel}`,
              }))}
            />
          )}
          {!!preview.changes.ended.length && (
            <ChangeGroup
              tone="ended"
              title={t("changesEnded")}
              items={preview.changes.ended.map((item) => ({
                key: item.id,
                text: `− ${item.name}`,
                detail: `Lv. ${item.level} → ${item.nextLevel}`,
              }))}
            />
          )}
          {!!preview.changes.slots.length && (
            <div className="settings-change-group slots">
              <b>{t("changesSlots")}</b>
              {preview.changes.slots.map((item) => (
                <span key={item.slot}>
                  {t(`changeSlot_${item.slot}`)}{" "}
                  <small>
                    {t("changeValue", {
                      before: formatChangeValue(item.before, t),
                      after: formatChangeValue(item.after, t),
                    })}
                  </small>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ChangeGroup({
  tone,
  title,
  items,
}: {
  tone: "started" | "ended";
  title: string;
  items: Array<{ key: string; text: string; detail: string }>;
}) {
  return (
    <div className={`settings-change-group ${tone}`}>
      <b>{title}</b>
      {items.map((item) => (
        <span key={item.key}>
          {item.text} <small>{item.detail}</small>
        </span>
      ))}
    </div>
  );
}

function formatChangeValue(value: number | boolean | null, t: ReturnType<typeof useTranslations<"Settings">>) {
  return typeof value === "boolean" ? t(value ? "available" : "busy") : (value ?? "—");
}
