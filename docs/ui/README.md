# UI Documentation

This directory is the entry point for understanding and changing Dashboard UI. Read the screen inventory before changing
navigation or feature composition, and read the component and overlay documents before adding reusable UI.

## Documents

- [Screens](screens.md): why each route exists, its primary task, critical information, actions, and states.
- [Components](components.md): implemented, legacy, and planned shared components with ownership boundaries.
- [Overlays and feedback](overlays-and-feedback.md): choosing Dialog versus route content, the fast import workflow, resource prompts, Toast, focus, and announcement
  behavior.
- [UI system implementation plan](system-plan.md): package structure, migration phases, dependencies, tests, and completion
  criteria.

Product behavior that is not primarily a UI composition concern remains in the feature documents:

- [Dashboard and Settings Guide](../dashboard-guide.md)
- [Village Data Update Flow](../village-data-flow.md)
- [Resource-aware Notification Policy](../resource-notification-policy.md)

## Status language

Use these terms consistently:

- **Implemented**: owned by `@multi-coc/ui` and catalogued in UI Lab.
- **Legacy**: currently works in Dashboard but depends on screen markup or legacy CSS and is not the long-term API.
- **Planned**: required target behavior or component that is not implemented yet.

Do not describe a planned component as if Dashboard already uses it. When a migration finishes, update the corresponding
status and remove obsolete legacy entries in the same change.

## Guiding priorities

1. The user must immediately understand the current task and the next meaningful action.
2. Loading, failure, stale data, pending mutation, and success must never be indistinguishable from idle state.
3. Mobile touch, keyboard focus, translated text, and PWA standalone mode are first-class layouts.
4. Route changes must preserve the App Shell and must not cause navigation movement or blank flashes.
5. Reusable behavior belongs in owned components; feature meaning and product copy belong in feature components.
6. Visual experimentation happens in `apps/ui-lab`; production components remain in `packages/ui`.

## Flow review

UI Lab has fixture-only routes for Import, Settings, Dashboard, and History. Each exposes scenario, viewport, latency, and
result controls so empty, failure, pending, long-content, and narrow-layout decisions can be reviewed before Dashboard
integration. These routes are prototypes, not alternate product implementations: they make no API calls, and approved
compositions must move to Dashboard feature code rather than being copied.
