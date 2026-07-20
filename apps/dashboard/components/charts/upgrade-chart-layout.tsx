import { ChartCard, ChartCardBody, ChartCardHeader, ChartCardTitle } from "@multi-coc/ui";
import type { ComponentProps, ReactNode } from "react";

type WithoutClassName<T> = Omit<T, "className">;

export function UpgradeChartPanel({
  kind,
  title,
  legend,
  children,
}: {
  kind: "completion" | "area";
  title: ReactNode;
  legend: ReactNode;
  children: ReactNode;
}) {
  return (
    <ChartCard className={kind === "completion" ? "completion-chart" : "upgrade-area-chart"}>
      <ChartCardHeader className="upgrade-chart-heading">
        <ChartCardTitle>{title}</ChartCardTitle>
        {legend}
      </ChartCardHeader>
      {children}
    </ChartCard>
  );
}

export function UpgradeChartBody({
  kind = "plot",
  ...props
}: WithoutClassName<ComponentProps<typeof ChartCardBody>> & { kind?: "plot" | "bars" }) {
  return <ChartCardBody {...props} className={kind === "bars" ? "completion-bars" : undefined} />;
}
