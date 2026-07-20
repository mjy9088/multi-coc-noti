import {
  Card,
  ContentSection,
  DataList,
  DataListItem,
  EntityHeader,
  Field,
  InputField,
  Label,
  PageIntro,
  RadioGroup,
  RadioGroupItem,
  Stat,
  StatGrid,
  Toolbar,
} from "@multi-coc/ui";
import type { AvailabilityFilter } from "@multi-coc/upgrade-availability";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

type WithoutClassName<T> = Omit<T, "className">;

export function DashboardIntro(props: WithoutClassName<ComponentProps<typeof PageIntro>>) {
  return <PageIntro {...props} spacing="none" className="hero-copy" />;
}

export function DashboardFilterToolbar(props: WithoutClassName<ComponentProps<typeof Toolbar>>) {
  return <Toolbar {...props} className="account-tools" />;
}

export function DashboardSearchField(props: WithoutClassName<ComponentProps<typeof InputField>>) {
  return <InputField {...props} className="dashboard-search-field" />;
}

export function DashboardAvailabilityFilter({
  label,
  value,
  onValueChange,
  options,
}: {
  label: ReactNode;
  value: AvailabilityFilter;
  onValueChange: (value: AvailabilityFilter) => void;
  options: Record<AvailabilityFilter, ReactNode>;
}) {
  return (
    <Field className="dashboard-availability-field">
      <Label>{label}</Label>
      <RadioGroup value={value} onValueChange={(next) => onValueChange(next as AvailabilityFilter)}>
        <RadioGroupItem value="all">{options.all}</RadioGroupItem>
        <RadioGroupItem value="home">{options.home}</RadioGroupItem>
        <RadioGroupItem value="any">{options.any}</RadioGroupItem>
      </RadioGroup>
    </Field>
  );
}

export function DashboardSummary(props: WithoutClassName<ComponentProps<typeof StatGrid>>) {
  return <StatGrid {...props} className="summary-strip" />;
}

export function DashboardStat({
  kind,
  emphasized = false,
  ...props
}: WithoutClassName<ComponentProps<typeof Stat>> & {
  kind: "accounts" | "home-available" | "builder-available" | "earliest";
  emphasized?: boolean;
}) {
  const className = [
    kind === "builder-available" && "builder-base-summary",
    kind === "earliest" && "small",
    emphasized && "green",
  ]
    .filter(Boolean)
    .join(" ");
  return <Stat {...props} className={className || undefined} />;
}

export function DashboardCard({
  kind,
  priority = "normal",
  ...props
}: WithoutClassName<ComponentProps<typeof Card>> & {
  kind: "village" | "upgrade";
  priority?: "normal" | "urgent";
}) {
  return (
    <Card
      {...props}
      className={kind === "village" ? "village-card" : `upgrade${priority === "urgent" ? " urgent" : ""}`}
    />
  );
}

type DashboardSectionKind = "villages" | "queue" | "outlook";

const dashboardSectionRules: Record<DashboardSectionKind, { className: string; scrollTarget: boolean }> = {
  villages: { className: "dashboard-scroll-section", scrollTarget: true },
  queue: { className: "queue-section dashboard-scroll-section", scrollTarget: true },
  outlook: { className: "upgrade-outlook", scrollTarget: false },
};

export function DashboardSection({
  kind,
  ...props
}: WithoutClassName<ComponentProps<typeof ContentSection>> & { kind: DashboardSectionKind }) {
  const rule = dashboardSectionRules[kind];
  return <ContentSection {...props} spacing="none" scrollTarget={rule.scrollTarget} className={rule.className} />;
}

export function HistoryIntro(props: WithoutClassName<ComponentProps<typeof PageIntro>>) {
  return <PageIntro {...props} spacing="none" className="history-header" />;
}

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

export function HistoryResult(props: WithoutClassName<ComponentProps<typeof DataListItem>>) {
  return <DataListItem {...props} className="history-card" />;
}

export function VillageDetailLayout(props: WithoutClassName<HTMLAttributes<HTMLElement>>) {
  return <section {...props} className="village-detail shell" />;
}

export function VillageIdentity(props: WithoutClassName<ComponentProps<typeof EntityHeader>>) {
  return <EntityHeader {...props} className="village-detail-header" />;
}

type VillagePanelKind = "availability" | "metrics" | "cooldown" | "helpers" | "equipment" | "upgrades";

const villagePanelRules: Record<VillagePanelKind, string> = {
  availability: "village-detail-card",
  metrics: "village-detail-card",
  cooldown: "village-detail-card cooldown-card",
  helpers: "village-detail-card",
  equipment: "village-detail-card equipment-card",
  upgrades: "village-detail-card village-upgrades",
};

export function VillagePanel({
  kind,
  ...props
}: WithoutClassName<ComponentProps<typeof Card>> & { kind: VillagePanelKind }) {
  return <Card {...props} className={villagePanelRules[kind]} />;
}

export function VillageMetricGrid(props: WithoutClassName<ComponentProps<typeof StatGrid>>) {
  return <StatGrid {...props} className="metric-grid" />;
}

export function VillageTextStat(props: WithoutClassName<ComponentProps<typeof Stat>>) {
  return <Stat {...props} className="metric-text" />;
}
