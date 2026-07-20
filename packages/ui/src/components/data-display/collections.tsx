import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export function StatGrid({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("ui-stat-grid", className)} {...props} />;
}

export function Stat({
  label,
  value,
  description,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { label: ReactNode; value: ReactNode; description?: ReactNode }) {
  return (
    <div className={cn("ui-stat", className)} {...props}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {description && <small>{description}</small>}
    </div>
  );
}

export function KeyValueGrid({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("ui-key-value-grid", className)} {...props} />;
}

export function KeyValueItem({
  label,
  value,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { label: ReactNode; value: ReactNode }) {
  return (
    <div className={cn("ui-key-value-item", className)} {...props}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function DataList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="list" className={cn("ui-data-list", className)} {...props} />;
}

export function DataListItem({
  selected = false,
  disabled = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { selected?: boolean; disabled?: boolean }) {
  return (
    <div
      role="listitem"
      className={cn("ui-data-list-item", className)}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      {...props}
    />
  );
}

export function StatusIndicator({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn("ui-status-indicator", `ui-status-indicator-${tone}`, className)} {...props}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
