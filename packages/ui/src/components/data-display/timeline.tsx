import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export function Timeline({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn("ui-timeline", className)} {...props} />;
}

export function TimelineItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("ui-timeline-item", className)} {...props} />;
}

export function TimelineMarker({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span aria-hidden="true" className={cn("ui-timeline-marker", `ui-timeline-marker-${tone}`, className)} {...props} />
  );
}

export function TimelineContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-timeline-content", className)} {...props} />;
}

export function TimelineMeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-timeline-meta", className)} {...props} />;
}
