import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Tooltip } from "./tooltip";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  tone?: "secondary" | "quiet" | "danger";
  tooltip?: boolean;
};

export function IconButton({
  label,
  children,
  className,
  tone = "secondary",
  tooltip = true,
  type = "button",
  ...props
}: IconButtonProps) {
  const button = (
    <button
      type={type}
      aria-label={label}
      className={cn("ui-icon-button", `ui-icon-button-${tone}`, className)}
      {...props}
    >
      {children}
    </button>
  );
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
