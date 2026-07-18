# Component Inventory

## Ownership rules

- Generic UI lives in `packages/ui` and is exported by `@multi-coc/ui`.
- UI Lab imports production components; it does not copy them.
- Dashboard feature components own product models, translations, routes, queries, and mutations.
- Shared package internals use relative imports. Consumers use package exports; `tsconfig.paths` aliases must not cross the
  package boundary.
- A component is not complete until its important states are visible in UI Lab and its interaction behavior is testable.

## Implemented owned components

### Button

Location: `packages/ui/src/components/button.tsx`.

Purpose: consistent action priority, sizing, pending state, disabled behavior, focus visibility, and touch-safe height.

Current variants:

- tones: primary, secondary, quiet, danger;
- sizes: small, medium, large;
- states: default, hover, pressed, focus-visible, disabled, pending.

Before broad Dashboard migration, add icon composition, pending accessible copy guidance, and component-level accessibility
coverage.

### Actions, forms, and containers

UI Lab now catalogues the owned `IconButton`, `Field`, `Label`, `Description`, `FieldError`, `Input`, `Textarea`, `Select`,
`Checkbox`, `Card`, `Badge`, and `Separator` APIs. Field controls derive stable accessible relationships from their parent
`Field`; icon-only actions require a label.

`ActionBar` groups final actions. Its sticky variant inherits the nearest `--ui-surface-context` through transparent
wrappers and owns a stacking context, top boundary, shadow, and safe-area padding so scrolled content never shows through
or obscures the final controls. Owned surfaces define this context automatically; a feature-defined surface with a custom
background must define it alongside that background. A padded scroll container exposes its inline and bottom padding
through `--ui-sticky-surface-inline-bleed` and `--ui-sticky-surface-block-end-bleed`; the sticky background then covers those
gutters as well as the action row. Other sticky regions use `ui-sticky-surface` instead of selecting a canvas or panel color
themselves.

`SplitLayout` is the base for adjacent panes. It makes each direct child fill the shared grid-row height and resets its
intrinsic minimum sizes; feature CSS owns the column proportions, gap, responsive collapse, and each pane's internal
overflow.

### Request and navigation states

`Spinner`, `RequestState`, `EmptyState`, `StaleNotice`, and `Skeleton` cover loading, failure, cached, empty, and
layout-preserving placeholder states. `Tabs` and `Tab` use Radix keyboard behavior; feature routes still own URL state.

### Dialog and Toast

The owned Radix-backed Dialog composition handles modal focus and responsive sheet presentation. `ToastProvider`,
`useToast`, and the global viewport support semantic intent, stable-ID replacement, actions, persistent errors, and timed
success/information feedback. Dashboard has not migrated its legacy overlays or feedback to these APIs yet.

## Legacy reusable UI

These elements work today but are not stable design-system APIs.

### FeedbackToast

Current location: `apps/dashboard/app/feedback-toast.tsx` and `app/styles/primitives.css`.

It shows one success or error message for Settings mutations. Replace it with owned Toast primitives and a global provider;
do not extend its current prop API.

### LoadingState and ErrorState

Current location: `apps/dashboard/app/request-state.tsx`.

They encode useful request behavior but remain tied to Dashboard markup and CSS. Migrate into Spinner, RequestState,
EmptyState, and StaleNotice primitives or feature-level compositions.

### Section tabs and navigation

History, Settings, and Dashboard use repeated button/class combinations. Preserve their URL-backed navigation semantics and
sticky mobile behavior while migrating presentation to owned Tabs/Navigation components.

### Cards, badges, fields, and lists

The existing screens repeat card, badge, input, select, checkbox, metric, and action-row patterns through legacy selectors.
They are migration evidence, not component APIs.

### Resource-status prompt

Settings currently contains hand-authored modal markup. Preserve the workflow, but replace its overlay, focus, escape, and
background interaction behavior with the planned Dialog primitive.

## Implemented primitive scope

### Actions

- `IconButton`: accessible label is mandatory; icon-only dimensions and tooltip policy are consistent.
- `ButtonGroup` remains intentionally absent until repeated grouping behavior proves necessary.

### Forms

- `Field`, `Label`, `Description`, and `FieldError` for accessible relationships;
- `Input`, `Textarea`, and `Select` with invalid, disabled, and pending-compatible states;
- `Checkbox` with a full-label touch target.

### Containers and status

- `Card` for semantic surface, padding, and selected/disabled variants;
- `Badge` for status and metadata, never as the sole indicator of critical state;
- `Separator`;
- `Spinner`, `RequestState`, `EmptyState`, and `StaleNotice`;
- `Skeleton` only where it reduces layout shift without concealing a long failure.

### Navigation

- `Tabs` for section selection when content and URL semantics match tabs;
- `NavLink` or application navigation composition for route destinations;
- pagination/load-more action composition.

### Overlays and feedback

- `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`, and action/footer composition;
- `Toast`, `ToastViewport`, and a provider/hook for global mutation feedback;
- a fast import composition and destructive confirmations remain product-level work; use Dialog only when workflow
  validation supports it.

See [Overlays and feedback](overlays-and-feedback.md) for behavioral requirements.

## Product feature components

These do not belong in the generic UI package even when they use primitives:

- `VillageCard`, `VillageMetrics`, `CooldownList`, and `UpgradeQueueItem`;
- `DashboardFilters`, `AvailabilitySummary`, and upgrade charts;
- `PasteExportFlow`, `ExportReview`, and a fast import entry composition;
- `UpgradeAlertSettings`, `VillageSettings`, and `GroupOrderSettings`;
- Upgrade and Sync History filters and result cards.

They may live under `apps/dashboard/features/<feature>` and import product types, translations, query hooks, and routes.

## Component acceptance checklist

- purpose and non-goals are documented;
- semantic variants are typed;
- focus, disabled, pending, error, and long-content states are covered where relevant;
- keyboard and accessible name behavior is tested;
- Korean and English examples fit at supported widths;
- reduced motion and mobile touch targets are checked;
- UI Lab displays the supported state matrix;
- no dependency on `legacy.css`;
- no app-local path alias leaks into the package.
