import { ContentSection, DataList, Toolbar } from "@multi-coc/ui";
import type { ComponentProps, ReactNode } from "react";

type WithoutClassName<T> = Omit<T, "className">;

export function HistorySection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <ContentSection
      eyebrow={eyebrow}
      title={title}
      description={description}
      spacing="none"
      className="history-section"
    >
      {children}
    </ContentSection>
  );
}

export function HistoryFilters({
  size = "full",
  ...props
}: WithoutClassName<ComponentProps<typeof Toolbar>> & { size?: "full" | "single" }) {
  return <Toolbar {...props} className={`history-filters${size === "single" ? " sync-history-filters" : ""}`} />;
}

export function HistoryResults({
  kind = "upgrades",
  ...props
}: WithoutClassName<ComponentProps<typeof DataList>> & { kind?: "upgrades" | "syncs" }) {
  return <DataList {...props} className={`history-list${kind === "syncs" ? " sync-history-list" : ""}`} />;
}
