import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function SplitLayout({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-split-layout", className)} {...props} />;
}
