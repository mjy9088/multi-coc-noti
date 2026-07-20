import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function EntityHeader({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <header className={cn("ui-entity-header", className)} {...props} />;
}

export function EntityHeaderIdentity({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-entity-header-identity", className)} {...props} />;
}

export function EntityHeaderTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("ui-entity-header-title", className)} {...props} />;
}

export function EntityHeaderMeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-entity-header-meta", className)} {...props} />;
}

export function EntityHeaderActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-entity-header-actions", className)} {...props} />;
}
