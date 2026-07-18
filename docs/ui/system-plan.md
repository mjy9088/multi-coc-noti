# UI System Implementation Plan

## Purpose

Establish a small, owned design system for Dashboard without freezing the current visual design or rewriting every screen
at once. The migration must make later visual redesign cheaper, preserve existing interaction and accessibility behavior,
and steadily remove `app/styles/legacy.css`.

This document is the implementation plan and decision record. Update it as phases finish or a library choice changes.
User-visible behavior remains documented in [Dashboard and Settings Guide](../dashboard-guide.md), and automated behavior
contracts remain registered in [Test Contracts](../testing.md). The UI documentation index, screen inventory, and component
inventory live alongside this plan under `docs/ui/`.

## Current state

- `packages/ui/src/styles` now contains the initial shared semantic colors, browser foundations, and Button styles.
- `app/styles/primitives.css` contains only mutation feedback styling.
- `app/styles/legacy.css` is approximately 36 KB and owns about 168 distinct selectors across every screen.
- `admin-panel.tsx` and `page.tsx` combine large feature surfaces with repeated presentation markup.
- Tailwind CSS 4, the local `cn()` helper, typed variants, and the owned actions, forms, containers, request states, Tabs,
  Dialog, and Toast primitives are available and catalogued in UI Lab.
- `apps/ui-lab` is a Next.js App Router catalogue with a persistent layout and multiple routes, but there is not yet an
  isolated accessibility or visual regression suite.

The existing request hooks, TanStack Query state, route boundaries, focus movement, pending feedback, and translated copy are
behavior contracts. Component migration must reuse them rather than rebuild network or workflow behavior inside visual
components.

Run the catalogue at `http://localhost:3100` with:

```bash
just dev-ui
```

The persistent header includes an input and counter. Change both, navigate among Foundations, Components, and Route
patterns, and confirm that their values and header geometry remain stable while only route content changes.

Run the desktop and mobile App Router layout check with:

```bash
pnpm --filter @multi-coc/ui-lab exec playwright install chromium # first run on a machine
pnpm test:ui
```

## Decisions

### Ownership and scope

Dashboard and UI Lab consume the owned design system through the `@multi-coc/ui` workspace package. UI Lab is a design and
route-layout verification consumer, not the location of component implementations. Public component APIs should remain
small and product-owned; this is not intended to become a general-purpose external library.

Use this target structure:

```text
apps/
  dashboard/
    app/styles/
      legacy.css          only UI that has not migrated yet
    components/           app composition and compatibility adapters
    features/             product components, hooks, and feature composition
  ui-lab/
    app/                  catalogue routes and persistent layout checks
packages/
  ui/
    src/components/       generic primitives with no product terminology
    src/lib/              class and component utilities
    src/styles/           semantic tokens, foundations, primitive styles
```

Feature code within Dashboard should converge on:

```text
apps/dashboard/
  components/
    layout/               app shell and reusable page composition
    feedback/             app feedback adapters during migration
  features/
    dashboard/
    history/
    settings/
    villages/             product components, hooks, and feature composition
```

Generic primitives must not import feature hooks, API clients, TanStack Query, route-specific translations, or product
models. Feature components may compose primitives and own product copy. Data hooks own server interaction and return state
to feature components.

Shared package imports use relative paths internally and `package.json` exports externally. Do not use a consuming app's
`tsconfig.paths` alias inside `packages/ui`; aliases are evaluated by the current compiler and could resolve differently in
Dashboard and UI Lab.

### Styling stack

- Keep CSS custom properties as the runtime source of semantic design tokens.
- Expose the same tokens through Tailwind CSS 4 `@theme` so utilities and component styles cannot drift.
- Use Tailwind utilities for local component composition; do not mechanically translate legacy selectors one for one.
- Use `class-variance-authority` for typed component variants.
- Use `clsx` and `tailwind-merge` through one local `cn()` helper.
- Use Radix Primitives for behavior-heavy accessible widgets such as Dialog and Tabs.
- Use Lucide for interface icons instead of adding new text glyphs or one-off SVG markup.
- Treat shadcn/ui as reference or copied starter code, not as a runtime component-library dependency or visual authority.

Do not introduce another themed component suite. It would add a second token and variant model that would later need to be
removed. Add a dependency only when the first component that needs it is implemented.

### Tokens

Tokens describe purpose, not the current color value. The initial token set must cover:

- surfaces: canvas, raised, inset, overlay;
- text: primary, secondary, muted, inverse, link;
- borders: subtle, default, strong, focus;
- intent: accent, success, warning, danger, information;
- interactive states: hover, pressed, selected, disabled, pending;
- typography: body, label, title, numeric/mono and their supported sizes;
- spacing, control height, radius, shadow, z-index, and motion duration/easing;
- safe-area-aware page and fixed-feedback offsets.

Component CSS and Tailwind classes must not add raw colors when an appropriate semantic token exists. Village-specific
colors remain dynamic data and should enter a component through a documented CSS custom property such as `--accent`.
Dark mode is not part of the initial migration, but semantic tokens must keep it possible without changing component APIs.

### Component API rules

- Prefer composition and native HTML semantics over a large configuration object.
- Variants describe semantic intent (`primary`, `secondary`, `danger`, `quiet`), not a color name.
- Every form control supports a programmatic label, error association, disabled state, and pending behavior where relevant.
- Every interactive primitive has visible `:focus-visible`, hover, pressed, and disabled states.
- Loading indicators expose accessible pending text and respect `prefers-reduced-motion`.
- Use `forwardRef` only where consumers actually need DOM focus or measurement; do not add it preemptively.
- A primitive must not hide navigation, mutation, or data-fetching side effects.
- Avoid wrapper components that only rename one HTML element without enforcing styling, accessibility, or behavior.

## Migration phases

### Phase 0: baseline and safeguards

1. Record representative Dashboard, History, Settings, village detail, loading, error, empty, toast, and mobile states.
2. [Done] Add a Next.js UI Lab with shared-component catalogue routes and a persistent App Router layout. Its header input
   and counter intentionally verify state preservation while moving between catalogue routes.
3. [In progress] Add Playwright coverage. Desktop and mobile persistent-layout route tests are in place; representative
   screenshots and broader keyboard-focus checks remain.
4. Document the supported viewport matrix and reduced-motion behavior.
5. Record baseline `legacy.css` bytes and selector count in this document or a checked script.

Exit criteria:

- Contributors can render primitives without navigating a complete product workflow.
- At least one desktop and one mobile visual baseline run in CI or a documented local command.
- Existing focus, loading, stale, error, pending, and toast behavior has a verification route or test case.

### Phase 1: foundations and utilities

1. [In progress] Expand semantic tokens and map them into Tailwind `@theme`; the initial shared token surface is in place.
2. [Done] Add the local `cn()` helper and typed variant dependency.
3. Normalize typography, native control inheritance, focus rings, reduced motion, and disabled appearance.
4. Add lint/review rules: new reusable UI must not add selectors to `legacy.css`, and raw colors require justification.

Exit criteria:

- Tokens cover all states needed by the first primitive set.
- Tailwind utilities and plain CSS resolve to the same runtime variables.
- No existing screen changes visually except for intentional browser-foundation fixes.

### Phase 2: core primitives

Implement and catalogue these in order:

1. [In progress] `Button` and `IconButton`; Button is catalogued, while IconButton and automated accessibility coverage
   remain.
2. `Field`, `Label`, `Input`, `Textarea`, `Select`, and `Checkbox`;
3. `Card`, `Badge`, `Separator`, and layout `Stack`/`Cluster` helpers only where repetition proves useful;
4. `Spinner`, `RequestState`, `EmptyState`, and `StaleNotice`;
5. `Toast` and its viewport/provider;
6. `Tabs` and `Dialog` using headless accessible primitives.

Each component needs:

- a narrow typed API and supported variants;
- default, focus, disabled, pending, error, and long translated-content examples where applicable;
- keyboard and accessible-name verification;
- mobile touch-target verification;
- no dependency on `legacy.css`.

Exit criteria:

- Feature code can build a complete form, navigation tabs, request state, dialog, and mutation feedback from owned
  primitives.
- Existing Toast and request-state components have migrated or become thin compatibility adapters.

### Phase 3: shared application chrome

Migrate the persistent App Shell, top-level navigation, locale switcher, install action, synchronization indicator, section
tabs, page container, and common headers. Preserve route persistence, sticky behavior, horizontal mobile scrolling, Quick
Paste handoff, and focus visibility.

Exit criteria:

- Shared chrome uses only tokens and owned components.
- Route transitions do not remount the App Shell or reintroduce the previous tab flicker.
- Corresponding legacy selectors are deleted in the same change that removes their final consumer.

### Phase 4: feature migration

Migrate one independently verifiable slice at a time in this order:

1. mutation Toast, loading/error/empty/stale states;
2. common form controls and action rows;
3. History filters, cards, pagination, and section navigation;
4. village detail cards, metrics, cooldowns, equipment, and actions;
5. Settings shell and authentication;
6. Settings Update Data flow;
7. upgrade-alert, village, and group-order settings;
8. Dashboard filters, village cards, queue, availability panel, and charts.

Dashboard is last because it has the greatest amount of screen-specific visualization and responsive behavior. Do not
block primitive or Settings migration on a final Dashboard visual direction.

For every slice:

1. Extract feature state and mutation orchestration from oversized screen files when needed.
2. Replace markup with primitives without changing product behavior.
3. Verify English and Korean, narrow and wide viewports, keyboard use, loading, error, empty, and populated states.
4. Delete unused legacy selectors immediately.
5. Update screenshot baselines only after reviewing intentional differences.

### Phase 5: legacy removal and stabilization

1. Confirm `legacy.css` has no consumers and delete it and its import.
2. Remove compatibility adapters and unused variants.
3. Audit token usage, accessible names, focus order, touch targets, motion, overflow, and translated text wrapping.
4. Decide whether the component catalogue remains a development route or moves to Storybook permanently.
5. Document the stable component inventory and contribution rules in the Dashboard guide.

Exit criteria:

- `legacy.css` is absent.
- No screen owns a duplicate implementation of a documented primitive.
- Full tests, lint, typecheck, production build, desktop/mobile visual tests, and keyboard checks pass.
- New feature work has one documented path for tokens, primitives, feature components, and async feedback.

## Feature decomposition targets

`admin-panel.tsx` should be divided into feature components without moving all state into a global store:

- `SettingsShell` and `AdminSignIn`;
- `PasteExportFlow` and `ExportReview`;
- `UpgradeAlertSettings`;
- `VillageSettings`;
- `GroupOrderSettings`;
- `ResourceStatusDialog`.

`page.tsx` should be divided into:

- `DashboardHero` and `DashboardFilters`;
- `DashboardSummary`;
- `VillageGrid` and `VillageCard`;
- `UpgradeQueue` and `UpgradeQueueItem`;
- chart and availability features that already have separate calculation boundaries.

Keep route-level data orchestration close to the route until repeated use justifies another abstraction. Component extraction
is not permission to introduce a global client store or duplicate TanStack Query data in local state.

## Verification strategy

Use the smallest layer that proves each concern:

- TypeScript and component examples for supported variants and prop contracts;
- DOM/accessibility tests for labels, roles, focus behavior, dialog trapping, tabs, and announcements;
- Playwright for route workflows, keyboard navigation, mobile viewport behavior, and screenshots;
- existing domain/unit tests for data calculation and policy behavior;
- existing `pnpm test`, lint, typecheck, and Next.js production build as the final gate.

Visual snapshots must cover meaningful stable states rather than every component permutation. Prefer assertions on semantic
state and accessibility for interaction behavior; use screenshots for layout, spacing, wrapping, overflow, focus treatment,
and responsive composition.

## Migration rules

- Do not combine a behavior rewrite with a visual migration unless the behavior change is independently documented and
  tested.
- Do not copy a legacy selector into a new file under a new name and count it as migration.
- Do not leave both old and new implementations active after a slice is complete.
- Preserve English and Korean copy length, mobile safe areas, PWA standalone mode, and reduced motion throughout.
- Keep changes reviewable: one primitive family or one feature slice per commit where practical.
- Update this plan's completed phases and the durable Dashboard guide as the system becomes stable.

## Completion measures

Track progress with concrete evidence:

- `legacy.css` byte size and unique selector count trend toward zero;
- number of screens using only owned primitives;
- component catalogue coverage of supported variants and async states;
- desktop/mobile visual test coverage for major routes;
- zero known keyboard, accessible-name, focus, overflow, or touch-target regressions;
- decreasing size of `admin-panel.tsx` and `page.tsx` through meaningful feature boundaries, not line movement alone.
