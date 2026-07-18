import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "ui-button inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      tone: {
        primary: "ui-button-primary",
        secondary: "ui-button-secondary",
        quiet: "ui-button-quiet",
        danger: "ui-button-danger",
      },
      size: {
        small: "ui-button-small",
        medium: "ui-button-medium",
        large: "ui-button-large",
      },
    },
    defaultVariants: { tone: "primary", size: "medium" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    pending?: boolean;
  };

export function Button({ className, children, disabled, pending = false, size, tone, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ tone, size }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <span className="ui-button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
