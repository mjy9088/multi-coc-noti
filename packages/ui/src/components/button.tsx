import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
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

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    pending?: boolean;
  };

export function Button({
  asChild = false,
  className,
  children,
  disabled,
  pending = false,
  size,
  tone,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ tone, size }), className)}
      disabled={asChild ? undefined : disabled || pending}
      aria-disabled={asChild && (disabled || pending) ? true : undefined}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <span className="ui-button-spinner" aria-hidden="true" />}
      {children}
    </Component>
  );
}
