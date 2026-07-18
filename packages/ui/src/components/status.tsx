import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("ui-spinner", className)} role="status">
      <span className="ui-visually-hidden">{label}</span>
    </span>
  );
}

export function RequestState({
  tone = "neutral",
  title,
  description,
  action,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: "neutral" | "error" | "warning";
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn("ui-request-state", `ui-request-state-${tone}`, className)}
      role={tone === "error" ? "alert" : "status"}
      {...props}
    >
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return <RequestState title={title} description={description} action={action} />;
}

export function StaleNotice({
  children,
  onRetry,
  retryLabel = "Retry",
}: {
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <RequestState
      tone="warning"
      title={children}
      action={
        onRetry && (
          <Button size="small" tone="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )
      }
    />
  );
}

export function Skeleton({ width = "100%", className }: { width?: string; className?: string }) {
  return <span className={cn("ui-skeleton", className)} style={{ width }} aria-hidden="true" />;
}
