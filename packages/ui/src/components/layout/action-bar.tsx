import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function ActionBar({
  sticky = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { sticky?: boolean }) {
  return (
    <div className={cn("ui-action-bar", sticky && "ui-action-bar-sticky ui-sticky-surface", className)} {...props} />
  );
}
