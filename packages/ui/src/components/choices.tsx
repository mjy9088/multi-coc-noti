"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn("ui-radio-group", className)} {...props} />;
}

export function RadioGroupItem({ className, children, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <label className={cn("ui-radio-item", className)}>
      <RadioGroupPrimitive.Item className="ui-radio-control" {...props}>
        <RadioGroupPrimitive.Indicator className="ui-radio-indicator" />
      </RadioGroupPrimitive.Item>
      <span>{children}</span>
    </label>
  );
}

export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root className={cn("ui-toggle-group", className)} {...props} />;
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item className={cn("ui-toggle-group-item", className)} {...props} />;
}
