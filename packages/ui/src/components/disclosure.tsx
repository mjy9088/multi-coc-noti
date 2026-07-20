import type { DetailsHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Disclosure({ className, ...props }: DetailsHTMLAttributes<HTMLDetailsElement>) {
  return <details className={cn("ui-disclosure", className)} {...props} />;
}

export function DisclosureSummary({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <summary className={cn("ui-disclosure-summary", className)} {...props} />;
}

export function DisclosureContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-disclosure-content", className)} {...props} />;
}
