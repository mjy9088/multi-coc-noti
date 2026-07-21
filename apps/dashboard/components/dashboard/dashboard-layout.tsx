import { Card, ContentSection, Field, Label, RadioGroup, RadioGroupItem, Stat } from "@multi-coc/ui";
import type { AvailabilityFilter } from "@multi-coc/upgrade-availability";
import type { ComponentProps, ReactNode } from "react";

type WithoutClassName<T> = Omit<T, "className">;

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
