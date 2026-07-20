import type { HTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { cn } from "../lib/cn";

type ProgressTone = "accent" | "success" | "warning" | "danger" | "info";

export function Progress({
  label,
  value,
  max = 100,
  valueLabel,
  tone = "accent",
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  label: ReactNode;
  value?: number;
  max?: number;
  valueLabel?: ReactNode;
  tone?: ProgressTone;
}) {
  const labelId = useId();
  return (
    <div className={cn("ui-progress", `ui-progress-${tone}`, className)} {...props}>
      <div className="ui-progress-heading">
        <span id={labelId}>{label}</span>
        {valueLabel && <span>{valueLabel}</span>}
      </div>
      <progress aria-labelledby={labelId} value={value} max={max} />
    </div>
  );
}
