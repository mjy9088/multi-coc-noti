"use client";

import {
  PageHeader,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderTitle,
  StickyStackItem,
  Tab,
  Tabs,
} from "@multi-coc/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function HistoryNav({ section }: { section: "upgrades" | "syncs" }) {
  const router = useRouter();
  const t = useTranslations("History");
  return (
    <>
      <PageHeader className="history-header">
        <PageHeaderContent>
          <PageHeaderEyebrow>HISTORY</PageHeaderEyebrow>
          <PageHeaderTitle>{t("historyTitle")}</PageHeaderTitle>
          <PageHeaderDescription>{t("historyDescription")}</PageHeaderDescription>
        </PageHeaderContent>
      </PageHeader>
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
