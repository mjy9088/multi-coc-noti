"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function SelectionList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="list" className={cn("ui-selection-list", className)} {...props} />;
}

export function SelectionListItem({
  asChild = false,
  selected = false,
  className,
  ...props
}: ComponentProps<"button"> & { asChild?: boolean; selected?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      type={asChild ? undefined : "button"}
      className={cn("ui-selection-list-item", className)}
      data-selected={selected || undefined}
      aria-pressed={!asChild ? selected : undefined}
      {...props}
    />
  );
}

export function SelectionListLeading({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ui-selection-list-leading", className)} {...props} />;
}

export function SelectionListContent({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ui-selection-list-content", className)} {...props} />;
}

export function SelectionListTitle({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ui-selection-list-title", className)} {...props} />;
}

export function SelectionListDescription({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ui-selection-list-description", className)} {...props} />;
}

export function SelectionListTrailing({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ui-selection-list-trailing", className)} {...props} />;
}
