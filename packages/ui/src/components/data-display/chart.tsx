import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Card } from "../display";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export function ChartCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <Card className={cn("ui-chart-card", className)} {...props} />;
}

export function ChartCardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-chart-card-header", className)} {...props} />;
}

export function ChartCardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("ui-chart-card-title", className)} {...props} />;
}

export function ChartCardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-chart-card-body", className)} {...props} />;
}

export function ChartLegend({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("ui-chart-legend", className)} {...props} />;
}

export function ChartLegendItem({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLLIElement> & { tone?: Tone }) {
  return (
    <li className={cn("ui-chart-legend-item", `ui-chart-legend-item-${tone}`, className)} {...props}>
      <i aria-hidden="true" />
      {children}
    </li>
  );
}
