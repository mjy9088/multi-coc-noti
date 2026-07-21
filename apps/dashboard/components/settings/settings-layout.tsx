import { FormGrid, InputField, SelectField, TextareaField } from "@multi-coc/ui";
import type { ComponentProps, FormHTMLAttributes, HTMLAttributes } from "react";

type WithoutClassName<T> = Omit<T, "className">;
type SettingsSurfaceKind = "import" | "preview" | "resource-prompt" | "channels" | "upgrades" | "groups";

const surfaceRules: Record<SettingsSurfaceKind, string> = {
  import: "settings-surface settings-export settings-step",
  preview: "settings-surface settings-preview settings-step",
  "resource-prompt": "settings-surface resource-inline-step",
  channels: "settings-surface settings-wide settings-notification-channels",
  upgrades: "settings-surface settings-wide settings-upgrade-alerts",
  groups: "settings-surface settings-group-card",
};

export function SettingsPage({
  embedded = false,
  ...props
}: WithoutClassName<HTMLAttributes<HTMLElement>> & { embedded?: boolean }) {
  return <section {...props} className={`settings-page${embedded ? " settings-page-embedded" : ""}`} />;
}

export function SettingsSurface({
  kind,
  step = "none",
  ...props
}: WithoutClassName<HTMLAttributes<HTMLElement>> & {
  kind: SettingsSurfaceKind;
  step?: "none" | "current" | "complete";
}) {
  const stepClass = step === "none" ? "" : ` step-${step}`;
  return <article {...props} className={`${surfaceRules[kind]}${stepClass}`} />;
}

type SettingsFieldPlacement = "default" | "wide" | "search" | "new-village";

const settingsFieldRules: Record<SettingsFieldPlacement, string | undefined> = {
  default: undefined,
  wide: "wide",
  search: "village-search",
  "new-village": "settings-new-label",
};

export function SettingsInputField({
  placement = "default",
  ...props
}: WithoutClassName<ComponentProps<typeof InputField>> & { placement?: SettingsFieldPlacement }) {
  return <InputField {...props} className={settingsFieldRules[placement]} />;
}

export function SettingsSelectField({
  placement = "default",
  ...props
}: WithoutClassName<ComponentProps<typeof SelectField>> & { placement?: SettingsFieldPlacement }) {
  return <SelectField {...props} className={settingsFieldRules[placement]} />;
}

export function SettingsTextareaField({
  placement = "default",
  ...props
}: WithoutClassName<ComponentProps<typeof TextareaField>> & { placement?: SettingsFieldPlacement }) {
  return <TextareaField {...props} className={settingsFieldRules[placement]} />;
}

type SettingsFieldsLayout = "form" | "controls";
type SettingsFieldsProps =
  | ({ as: "form"; layout: SettingsFieldsLayout } & FormHTMLAttributes<HTMLFormElement>)
  | ({ as?: "div"; layout: SettingsFieldsLayout } & HTMLAttributes<HTMLDivElement>);

export function SettingsFields(props: SettingsFieldsProps) {
  const { layout } = props;
  const className = layout === "form" ? "settings-form" : "settings-upgrade-controls";
  if (props.as === "form") {
    const { as: _as, layout: _layout, ...formProps } = props;
    void _as;
    void _layout;
    return (
      <FormGrid asChild columns={layout === "form" ? "two" : "auto"} className={className}>
        <form {...formProps} />
      </FormGrid>
    );
  }
  const { as: _as, layout: _layout, ...divProps } = props;
  void _as;
  void _layout;
  return (
    <FormGrid asChild columns={layout === "form" ? "two" : "auto"} className={className}>
      <div {...divProps} />
    </FormGrid>
  );
}
