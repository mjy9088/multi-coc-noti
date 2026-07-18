import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  tone?: "secondary" | "quiet" | "danger";
};

export function IconButton({
  label,
  children,
  className,
  tone = "secondary",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn("ui-icon-button", `ui-icon-button-${tone}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
