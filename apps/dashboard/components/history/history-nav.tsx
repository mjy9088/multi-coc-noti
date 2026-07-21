"use client";

import { PageIntro, StickyStackItem, Tab, Tabs } from "@multi-coc/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function HistoryNav({ section }: { section: "upgrades" | "syncs" }) {
  const router = useRouter();
  const t = useTranslations("History");
  return (
    <>
      <PageIntro
        className="history-header"
        spacing="none"
        eyebrow="HISTORY"
        title={t("historyTitle")}
        description={t("historyDescription")}
      />
      <StickyStackItem order={10} as="nav" className="history-tabs-sticky">
        <Tabs
          className="history-sections"
          label={t("sections")}
          value={section}
          onValueChange={(value) => router.push(`/history/${value}`, { scroll: false })}
        >
          <Tab value="upgrades">{t("upgrades")}</Tab>
          <Tab value="syncs">{t("syncs")}</Tab>
        </Tabs>
      </StickyStackItem>
    </>
  );
}
