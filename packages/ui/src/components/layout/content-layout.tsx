import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function PageContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-page-container", className)} {...props} />;
}

export function Stack({
  gap = "medium",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { gap?: "small" | "medium" | "large" }) {
  return <div className={cn("ui-stack", `ui-stack-${gap}`, className)} {...props} />;
}

export function Cluster({
  gap = "medium",
  align = "center",
  justify = "start",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  gap?: "small" | "medium" | "large";
  align?: "start" | "center" | "end";
  justify?: "start" | "center" | "end" | "between";
}) {
  return (
    <div
      className={cn("ui-cluster", `ui-cluster-${gap}`, className)}
      data-align={align}
      data-justify={justify}
      {...props}
    />
  );
}

export function ContentGrid({
  sidebarWidth = "18rem",
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { sidebarWidth?: string }) {
  return (
    <div
      className={cn("ui-content-grid", className)}
      style={{ ...style, "--ui-content-sidebar-width": sidebarWidth } as CSSProperties}
      {...props}
    />
  );
}
