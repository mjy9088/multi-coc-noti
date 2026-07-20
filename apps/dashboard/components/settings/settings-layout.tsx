import {
  ActionBar,
  DetailPane,
  DetailPaneBackdrop,
  FormGrid,
  InputField,
  MasterDetailLayout,
  MasterPane,
  PageIntro,
  ScrollablePane,
  SelectField,
  StickyRouteFrame,
  TextareaField,
} from "@multi-coc/ui";
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

export function SettingsIntro(props: WithoutClassName<ComponentProps<typeof PageIntro>>) {
  return <PageIntro {...props} spacing="none" className="settings-page-header" />;
}

export function SettingsRouteFrame(props: WithoutClassName<ComponentProps<typeof StickyRouteFrame>>) {
  return <StickyRouteFrame {...props} className="settings-route-frame" />;
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

export function SettingsVillageLayout(props: WithoutClassName<ComponentProps<typeof MasterDetailLayout>>) {
  return <MasterDetailLayout {...props} className="settings-village-layout" />;
}

export function SettingsVillageListPane(props: WithoutClassName<ComponentProps<typeof MasterPane>>) {
  return <MasterPane {...props} className="settings-surface settings-village-list-card ui-sticky-surface" />;
}

export function SettingsVillagePicker(props: WithoutClassName<ComponentProps<typeof ScrollablePane>>) {
  return <ScrollablePane {...props} className="settings-village-picker" boundary="contain" activation="sticky-frame" />;
}

export function SettingsVillageBackdrop(props: WithoutClassName<ComponentProps<typeof DetailPaneBackdrop>>) {
  return <DetailPaneBackdrop {...props} className="settings-sheet-backdrop" />;
}

export function SettingsVillageEditor(props: WithoutClassName<ComponentProps<typeof DetailPane>>) {
  return <DetailPane {...props} className="settings-surface settings-village-editor-card" />;
}

export function SettingsVillageEditorScroll(props: WithoutClassName<ComponentProps<typeof ScrollablePane>>) {
  return (
    <ScrollablePane
      {...props}
      className="village-editor-scroll"
      boundary="contain"
      activation="sticky-frame-or-compact"
    />
  );
}

export function SettingsActions(props: WithoutClassName<ComponentProps<typeof ActionBar>>) {
  return <ActionBar {...props} className="settings-action-bar" sticky />;
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
