"use client";

import { Slot } from "@radix-ui/react-slot";
import {
  createContext,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from "react";
import { cn } from "../lib/cn";

type FieldContextValue = { controlId: string; descriptionId: string; errorId: string; invalid: boolean };
const FieldContext = createContext<FieldContextValue | null>(null);

function useField(part: string) {
  const value = useContext(FieldContext);
  if (!value) throw new Error(`${part} must be rendered inside Field`);
  return value;
}

export function Field({
  children,
  invalid = false,
  className,
}: {
  children: ReactNode;
  invalid?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <FieldContext
      value={{ controlId: `${id}-control`, descriptionId: `${id}-description`, errorId: `${id}-error`, invalid }}
    >
      <div className={cn("ui-field", className)} data-invalid={invalid || undefined}>
        {children}
      </div>
    </FieldContext>
  );
}

export function Label({ className, ...props }: HTMLAttributes<HTMLLabelElement>) {
  const { controlId } = useField("Label");
  return <label htmlFor={controlId} className={cn("ui-label", className)} {...props} />;
}

export function Description({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useField("Description");
  return <p id={descriptionId} className={cn("ui-description", className)} {...props} />;
}

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { errorId } = useField("FieldError");
  return <p id={errorId} className={cn("ui-field-error", className)} {...props} />;
}

function fieldControlProps(context: FieldContextValue, describedBy?: string) {
  return {
    id: context.controlId,
    "aria-invalid": context.invalid || undefined,
    "aria-describedby": [context.descriptionId, context.invalid ? context.errorId : null, describedBy]
      .filter(Boolean)
      .join(" "),
  };
}

export function Input({ className, "aria-describedby": describedBy, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const context = useField("Input");
  return <input className={cn("ui-input", className)} {...fieldControlProps(context, describedBy)} {...props} />;
}

export function Textarea({
  className,
  "aria-describedby": describedBy,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const context = useField("Textarea");
  return (
    <textarea
      className={cn("ui-input ui-textarea", className)}
      {...fieldControlProps(context, describedBy)}
      {...props}
    />
  );
}

export function Select({
  className,
  "aria-describedby": describedBy,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const context = useField("Select");
  return (
    <select className={cn("ui-input ui-select", className)} {...fieldControlProps(context, describedBy)} {...props} />
  );
}

type FieldCompositionProps = {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  labelVisibility?: "visible" | "hidden";
  className?: string;
};

function FieldComposition({
  label,
  description,
  error,
  labelVisibility = "visible",
  className,
  children,
}: FieldCompositionProps & { children: ReactNode }) {
  return (
    <Field invalid={Boolean(error)} className={className}>
      <Label className={labelVisibility === "hidden" ? "ui-visually-hidden" : undefined}>{label}</Label>
      {children}
      {description && <Description>{description}</Description>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function InputField({
  label,
  description,
  error,
  labelVisibility,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldCompositionProps) {
  return (
    <FieldComposition
      label={label}
      description={description}
      error={error}
      labelVisibility={labelVisibility}
      className={className}
    >
      <Input {...props} />
    </FieldComposition>
  );
}

export function SelectField({
  label,
  description,
  error,
  labelVisibility,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldCompositionProps) {
  return (
    <FieldComposition
      label={label}
      description={description}
      error={error}
      labelVisibility={labelVisibility}
      className={className}
    >
      <Select {...props} />
    </FieldComposition>
  );
}

export function TextareaField({
  label,
  description,
  error,
  labelVisibility,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldCompositionProps) {
  return (
    <FieldComposition
      label={label}
      description={description}
      error={error}
      labelVisibility={labelVisibility}
      className={className}
    >
      <Textarea {...props} />
    </FieldComposition>
  );
}

export function FormGrid({
  columns = "auto",
  asChild = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { columns?: "one" | "two" | "auto"; asChild?: boolean }) {
  const Component = asChild ? Slot : "div";
  return <Component className={cn("ui-form-grid", className)} data-columns={columns} {...props} />;
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const descriptionId = useId();
  return (
    <label className={cn("ui-checkbox", className)}>
      <input type="checkbox" aria-describedby={description ? descriptionId : undefined} {...props} />
      <span className="ui-checkbox-copy">
        <strong>{label}</strong>
        {description && <span id={descriptionId}>{description}</span>}
      </span>
    </label>
  );
}
