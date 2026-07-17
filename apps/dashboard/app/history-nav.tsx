"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function HistoryNav({ section }: { section: "upgrades" | "syncs" }) {
  const router = useRouter();
  const t = useTranslations("History");
  return (
    <>
      <header className="history-header">
        <p className="eyebrow">HISTORY</p>
        <h1>{t("historyTitle")}</h1>
        <p>{t("historyDescription")}</p>
      </header>
      <div className="history-sections section-tabs" role="navigation" aria-label={t("sections")}>
        <button className={section === "upgrades" ? "active" : ""} onClick={() => router.push("/history/upgrades")}>
          {t("upgrades")}
        </button>
        <button className={section === "syncs" ? "active" : ""} onClick={() => router.push("/history/syncs")}>
          {t("syncs")}
        </button>
      </div>
    </>
  );
}
