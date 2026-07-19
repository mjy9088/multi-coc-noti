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

`StickyStackProvider` measures registered `StickyStackItem`s with `ResizeObserver`. Every item receives the cumulative
offset of the items before it, while descendants receive `--ui-sticky-stack-total-offset` and
`--ui-viewport-available-height`. App chrome and route navigation register in document order; viewport-bounded panes use
the available-height variable instead of subtracting guessed header or tab heights. Keep horizontal overflow on an inner
element such as `Tabs`, not on the registered sticky wrapper. `StickyStackViewport` combines `SplitLayout` with the measured
cumulative top position and remaining height. Feature CSS may provide paired
`--ui-sticky-viewport-block-start-gap`/`--ui-sticky-viewport-block-end-gap` values, columns, and responsive collapse, but
must not recalculate either dimension or leave one viewport edge unintentionally flush.

Surfaces that coordinate nested scrolling and actions publish one `--ui-surface-inset` and use it for their own padding.
When an ActionBar reaches a surface edge, the surface removes that edge's padding and the ActionBar owns the final inset;
the container and action row must not each add a second copy of the same spacing.

The same ownership rule applies beyond sticky height: a component that owns a changing dimension or position publishes the
measurement, and consumers derive behavior from that value. Feature code must not repeat responsive pixel breakpoints in
`matchMedia`, compare `getBoundingClientRect()` with magic offsets, or reproduce another component's padding/height formula.
Prefer intrinsic Grid/Flex sizing and CSS/container queries first; use an owned measurement context only where behavior
cannot be expressed by CSS. `useStickyStack` and `ui-sticky-scroll-target` cover scroll-spy and anchor positioning beneath
the application chrome.

`StickyRouteFrame` wraps route bodies after sticky Tabs. The frame occupies the measured viewport below the sticky stack and
owns vertical overflow; feature content keeps its natural height and never receives scroll-stability filler. A route-specific
`scrollKey` returns the frame to its top on destination changes. Viewport-filling panes such as Village Settings use
`SplitLayout` at `height: 100%` inside the same frame instead of creating a second sticky viewport. Navigation within the
same persistent shell also uses the router's `scroll: false` option.

### Enforced layout contracts

`pnpm lint:ui-contracts` turns settled layout solutions into actionable CSS diagnostics. Do not reimplement bottom-sticky
actions, let top-corner-only sheets float above their bottom edge, omit a sticky surface strategy, configure only one sticky
bleed axis, top-align a named multi-pane layout, use sub-1rem form controls, introduce magic stacking or visual values, or
build a feature-local overlay. Surface-colored containers must publish their context, and scroll containers must opt out of
intrinsic minimum sizing. JSX checks also reject click handlers on non-interactive elements, unlabeled symbol-only buttons,
and feature-local feedback imports. Non-zero sticky offsets must use semantic variables, and feature CSS may not subtract
manually maintained shell/sticky heights from `100dvh`. Diagnostics point to `ActionBar`, `StickyStackProvider`,
`StickyStackItem`, `ui-sticky-surface`, paired bleed variables, `SplitLayout`, semantic tokens, `Button`/`Link`,
`IconButton`, `Dialog`, or `useToast` as appropriate. See
[Test contracts: Formatting and linting](../testing.md#formatting-and-linting) for the narrowly scoped suppression syntax.

### Request and navigation states

`Spinner`, `RequestState`, `EmptyState`, `StaleNotice`, and `Skeleton` cover loading, failure, cached, empty, and
layout-preserving placeholder states. `Tabs` and `Tab` use Radix keyboard behavior; feature routes still own URL state.

### Dialog and Toast

The owned Radix-backed Dialog composition handles modal focus and responsive sheet presentation. `ToastProvider`,
`useToast`, and the global viewport support semantic intent, stable-ID replacement, actions, persistent errors, and timed
success/information feedback. Dashboard mounts the provider at its persistent app boundary; Settings mutation feedback and
the resource-status prompt now use the shared Toast and Dialog paths.

## Legacy reusable UI

These elements work today but are not stable design-system APIs.

### LoadingState and ErrorState

Current location: `apps/dashboard/app/request-state.tsx`.

They encode useful request behavior but remain tied to Dashboard markup and CSS. Migrate into Spinner, RequestState,
EmptyState, and StaleNotice primitives or feature-level compositions.

### Section tabs and navigation

History and Dashboard still use repeated button/class combinations. Settings uses the owned Tabs path; preserve URL-backed
navigation semantics and sticky mobile behavior while migrating the remaining screens.

### Cards, badges, fields, and lists

The remaining legacy screens repeat card, badge, input, select, checkbox, metric, and action-row patterns. Settings forms
and actions now use the owned primitives; legacy patterns elsewhere remain migration evidence, not component APIs.

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
- a fast import composition remains product-level work; Settings destructive confirmation uses Dialog, and other workflows
  should do so only when their validation supports it.

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
