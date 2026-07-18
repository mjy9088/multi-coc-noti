"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Card({
  selected = false,
  disabled = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { selected?: boolean; disabled?: boolean }) {
  return (
    <div
      className={cn("ui-card", className)}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "success" | "warning" | "danger" }) {
  return <span className={cn("ui-badge", `ui-badge-${tone}`, className)} {...props} />;
}

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn("ui-separator", `ui-separator-${orientation}`, className)}
    />
  );
}

export function Tabs({
  label,
  children,
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root> & { label: string }) {
  return (
    <TabsPrimitive.Root {...props}>
      <TabsPrimitive.List aria-label={label} className={cn("ui-tabs", className)}>
        {children}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

export function Tab({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn("ui-tab", className)} {...props} />;
}
