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

## Planned primitives

### Actions

- `IconButton`: accessible label is mandatory; icon-only dimensions and tooltip policy are consistent.
- `ButtonGroup` only if repeated grouping behavior proves necessary.

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
- a fast import composition using form, review, and feedback primitives; use Dialog only if workflow validation supports it;
- confirmation Dialog compositions for destructive actions.

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
