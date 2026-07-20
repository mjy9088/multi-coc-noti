import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function PageHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={cn("ui-page-header", className)} {...props} />;
}

export function PageHeaderContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-page-header-content", className)} {...props} />;
}

export function PageHeaderEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-page-header-eyebrow", className)} {...props} />;
}

export function PageHeaderTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("ui-page-header-title", className)} {...props} />;
}

export function PageHeaderDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-page-header-description", className)} {...props} />;
}

export function PageHeaderActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-page-header-actions", className)} {...props} />;
}

export function SectionHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={cn("ui-section-header", className)} {...props} />;
}

export function SectionHeaderContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-section-header-content", className)} {...props} />;
}

export function SectionHeaderTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("ui-section-header-title", className)} {...props} />;
}

export function SectionHeaderDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-section-header-description", className)} {...props} />;
}

export function SectionHeaderActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-section-header-actions", className)} {...props} />;
}

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-toolbar", className)} {...props} />;
}

export function ResponsiveGrid({
  minItemWidth = "16rem",
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { minItemWidth?: string }) {
  return (
    <div
      className={cn("ui-responsive-grid", className)}
      style={{ ...style, "--ui-grid-min-item-width": minItemWidth } as CSSProperties}
      {...props}
    />
  );
}

export function ScrollablePane({
  boundary = "handoff",
  activation = "always",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  boundary?: "handoff" | "contain";
  activation?: "always" | "sticky-frame" | "sticky-frame-or-compact";
}) {
  return (
    <div
      className={cn("ui-scrollable-pane", className)}
      data-scroll-boundary={boundary}
      data-scroll-activation={activation}
      {...props}
    />
  );
}
