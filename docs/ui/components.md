# Component Inventory

## Ownership rules

- Generic UI lives in `packages/ui` and is exported by `@multi-coc/ui`.
- UI Lab imports production components; it does not copy them.
- Dashboard feature components own product models, translations, routes, queries, and mutations.
- Shared package internals use relative imports. Consumers use package exports; `tsconfig.paths` aliases must not cross the
  package boundary.
- A component is not complete until its important states are visible in UI Lab and its interaction behavior is testable.

## Component hierarchy

Keep the ownership layers explicit instead of moving every repeated product shape into one flat component catalogue:

1. **Primitives** provide one interaction or surface contract: Button, form controls, Card, Badge, Tabs, Dialog, and Toast.
2. **Layout compositions** arrange arbitrary content without knowing product data: PageHeader, SectionHeader, Toolbar,
   ResponsiveGrid, ScrollablePane, SplitLayout, ActionBar, and the sticky-stack components. They live under
   `packages/ui/src/components/layout` when they are not an established flat primitive.
3. **Data-display patterns** provide semantic repeated structures without knowing routes or domain models: StatGrid,
   KeyValueGrid, DataList, StatusIndicator, EntityHeader, Timeline, and ChartCard. They live under
   `packages/ui/src/components/data-display`.
4. **Product feature components** know villages, upgrades, exports, translations, queries, or mutations and remain in the
   consuming app.

Higher layers may import lower layers; primitives and generic layouts must not import data-display or product features.
CSS follows the same ownership. A pattern owns its internal spacing and states, while a screen owns only section placement,
domain-specific color mapping, and exceptional responsive composition.

## Public component responsibility reference

### Primitives and interaction

| Components | Own | Do not own |
| --- | --- | --- |
| `Button`, `IconButton` | Action priority, sizing, focus, disabled and pending presentation | Mutation, navigation, permission, or confirmation policy |
| `Field`, `Label`, `Description`, `FieldError` | Accessible form relationships and validation presentation | Form state or server validation |
| `Input`, `Textarea`, `Select` | Consistent native-control sizing and states | Parsing, debounce, options, or persistence |
| `Checkbox`, `RadioGroup`, `ToggleGroup` | Accessible boolean and single-choice interaction | Filter meaning or storage |
| `Card` and its structural parts | Generic surface and header/body/footer alignment | Product record mapping |
| `Badge`, `Separator`, `StatusIndicator` | Compact semantic metadata and visual separation | Critical information without visible text |
| `NavLink`, `Tabs`, `Tab`, `TabContent` | Navigation/section semantics and keyboard interaction | Router state or URL construction |
| `Disclosure` | Native expandable content with focus and motion treatment | Floating positioning or modal behavior |
| `Tooltip` | Supplemental hover/focus explanation | Mobile-required instructions or accessible names |
| `Dialog` composition | Modal focus, backdrop, Escape, mobile sheet geometry | Feature state, validation, or mutation timing |
| `ToastProvider`, `useToast` | Global announced transient feedback | Inline validation or the initiating control's pending state |
| `Progress` | Accessible determinate/indeterminate progress and semantic tone | Domain time calculation or chart series |

### Layout compositions

| Components | Own | Do not own |
| --- | --- | --- |
| `PageContainer` | Content width, viewport gutter, safe-area and page block spacing | Section order or route loading |
| `Stack`, `Cluster` | Repeated vertical or wrapping horizontal rhythm | Product-specific responsive priority |
| `ContentGrid`, `ResponsiveGrid` | Common sidebar and auto-fit grid behavior | Domain card minimums not expressible as component input |
| `PageHeader`, `SectionHeader` families | Title, description and action wrapping | Product copy or breadcrumb policy |
| `Toolbar` | Bounded wrapping control surface | Filter state or query behavior |
| `SplitLayout` | Equal-height adjacent panes and intrinsic-size reset | Column proportions and mobile product meaning |
| `MasterDetailLayout`, `MasterPane`, `DetailPane`, `DetailPaneBackdrop` | Desktop paired panes and compact bottom-sheet transition | Selected entity state, close decision, or editor contents |
| `ScrollablePane` | Overflow safety, boundary handoff/containment and sticky-frame activation | Choosing whether product content should be independently scrollable |
| `ActionBar` | Final-action grouping, sticky surface, safe-area and bleed behavior | Which action is primary or whether data is dirty |
| `StickyStackProvider`, `StickyStackItem`, `StickyStackViewport`, `StickyRouteFrame` | Measured chrome offsets and viewport ownership | Route definitions or feature layout |

### Data-display patterns and request states

| Components | Own | Do not own |
| --- | --- | --- |
| `StatGrid`, `Stat` | Compact labelled metrics with wrapping values | Metric calculation or priority |
| `KeyValueGrid`, `KeyValueItem` | Label/value facts | Product field selection |
| `DataList`, `DataListItem` | Read-only repeated record surfaces | Selection or navigation interaction |
| `SelectionList` family | Interactive selected rows, focus, leading/content/trailing structure | Search, routing, or selected-record state |
| `EntityHeader` family | Repeated identity, metadata and action alignment | Entity model or status derivation |
| `Timeline` family | Chronological marker/content/time layout | Event ordering or timestamp formatting |
| `ChartCard`, `ChartLegend` | Chart surface, title, clipping safety and semantic legend | SVG/canvas rendering, axes, series calculation, or domain colors |
| `Spinner`, `Skeleton` | Pending and layout-preserving visual state | Fetch lifecycle |
| `RequestState`, `EmptyState`, `StaleNotice` | Accessible loading/error/empty/stale presentation | Retry implementation or cache policy |

`cn` is the package class-name utility, and `useStickyStack` exposes the measured sticky height for behavior that cannot be
expressed with CSS alone. Neither is a visual component.

## Implemented owned components

### Button

Location: `packages/ui/src/components/button.tsx`.

Purpose: consistent action priority, sizing, pending state, disabled behavior, focus visibility, and touch-safe height.

Current variants:

- tones: primary, secondary, quiet, danger;
- sizes: small, medium, large;
- states: default, hover, pressed, focus-visible, disabled, pending.

Further hardening should add richer icon composition, pending accessible-copy guidance, and component-level accessibility
coverage.

### Actions, forms, and containers

UI Lab now catalogues the owned `IconButton`, `Field`, `Label`, `Description`, `FieldError`, `Input`, `Textarea`, `Select`,
`Checkbox`, `RadioGroup`, `ToggleGroup`, structured `Card`, `Badge`, and `Separator` APIs. Field controls derive stable
accessible relationships from their parent `Field`; icon-only actions require a label.

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

## Migrated compatibility UI

These elements work today but are not stable design-system APIs.

### LoadingState and ErrorState

Current location: `apps/dashboard/app/request-state.tsx`.

These are thin translated Dashboard adapters over the owned `Spinner`, `RequestState`, and `Button` primitives. Feature
screens may retain the adapters where they avoid duplicating localized request copy; they no longer own visual behavior.

### Section tabs and navigation

Settings and History use owned Tabs and the shared measured sticky stack. Dashboard's in-page section navigation uses owned
Buttons because it scrolls to content regions rather than switching tab panels.

### Cards, badges, fields, and lists

Dashboard, village detail, History, and Settings now compose owned Card, Badge, form, status, Button, Tabs, Dialog, and
ActionBar primitives. Product-specific metrics, charts, availability blocks, and result rows remain feature components;
their layout CSS uses shared semantic tokens rather than becoming generic component APIs.

### Layout compositions and data-display patterns

The generic middle layer now includes PageContainer, Stack, Cluster, PageHeader and SectionHeader compositions, Toolbar,
ContentGrid, ResponsiveGrid, SplitLayout, responsive MasterDetail panes, ScrollablePane, StatGrid, KeyValueGrid, DataList,
SelectionList, StatusIndicator, EntityHeader, Timeline, Progress, Disclosure, and ChartCard with ChartLegend. These
components own common semantics, wrapping, spacing, narrow-screen behavior, and overflow safety. They deliberately accept
rendered content instead of product records: mapping a village, upgrade, sync, or chart series remains a Dashboard feature
concern.

`ScrollablePane` defaults to `boundary="handoff"`, allowing wheel and touch scroll to continue in the nearest outer owner
when the pane reaches an edge. Use `boundary="contain"` only for deliberately independent panes such as a modal sheet or a
viewport-filling master/detail pane. A pane inside `StickyRouteFrame` that should not capture wheel input while the outer
page is still approaching its sticky position uses `activation="sticky-frame"`; the shared frame enables its overflow only
after it becomes fixed. A responsive pane that becomes a self-contained sheet on compact viewports uses
`activation="sticky-frame-or-compact"`, which activates immediately at the design-system compact breakpoint. Feature CSS
must not reproduce these state-dependent overflow switches.

## Implemented primitive scope

### Actions

- `IconButton`: accessible label is mandatory; icon-only dimensions and tooltip policy are consistent.
- `ButtonGroup` remains intentionally absent until repeated grouping behavior proves necessary.

### Forms

- `Field`, `Label`, `Description`, and `FieldError` for accessible relationships;
- `Input`, `Textarea`, and `Select` with invalid, disabled, and pending-compatible states;
- `Checkbox` with a full-label touch target;
- `RadioGroup` for visible single-choice forms and `ToggleGroup` for compact view/filter choices.

### Containers and status

- `Card` for semantic surface, padding, and selected/disabled variants, with optional header, title, body, and footer
  structure;
- `Badge` for status and metadata, never as the sole indicator of critical state;
- `Separator`;
- `Spinner`, `RequestState`, `EmptyState`, and `StaleNotice`;
- `Skeleton` only where it reduces layout shift without concealing a long failure.

### Navigation

- `Tabs`, `Tab`, and `TabContent` for section selection when content and URL semantics match tabs;
- `NavLink` for route destinations and `Button asChild` for links with action emphasis;
- pagination/load-more action composition.

### Overlays and feedback

- `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`, and action/footer composition;
- `Toast`, `ToastViewport`, and a provider/hook for global mutation feedback;
- the implemented fast import composition remains product-owned while reusing the shared Dialog and Settings import flow;
  Settings destructive confirmation uses Dialog, and other workflows should do so only when their validation supports it.

### Tooltip

`Tooltip` provides supplemental hover and keyboard-focus copy, and `IconButton` uses its accessible label as tooltip copy
by default. A tooltip must never be the only source of an action's name, state, validation result, or instructions. Coarse
touch pointers do not render the floating tooltip: the trigger still exposes its accessible name and activates on the first
tap. Help that must be discoverable and readable on mobile belongs in visible copy or an explicit help action backed by a
Dialog/Popover, not in a Tooltip. `TooltipProvider` belongs at the persistent application boundary.

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
