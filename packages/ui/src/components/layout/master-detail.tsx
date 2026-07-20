import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function MasterDetailLayout({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-master-detail", className)} {...props} />;
}

export function MasterPane({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("ui-master-pane", className)} {...props} />;
}

export function DetailPane({ open = false, className, ...props }: HTMLAttributes<HTMLElement> & { open?: boolean }) {
  return <aside className={cn("ui-detail-pane", className)} data-open={open || undefined} {...props} />;
}

export function DetailPaneBackdrop({
  open = false,
  label,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string; open?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("ui-detail-pane-backdrop", className)}
      data-open={open || undefined}
      {...props}
    />
  );
}
