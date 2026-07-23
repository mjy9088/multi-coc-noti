# Overview

`apps/dashboard/components/settings`

## Purpose

Settings feature boundary. Owns loading and mutation orchestration, import review, notification configuration, village
editing, group order, dialogs, local models, typed layout rules, and adjacent CSS.

## Key files

- `settings-panel.tsx` — feature coordinator and paste/review workflow.
- `import-data/import-data-tab.tsx` — paste, review, changes, and resource-response composition.
- `notification-channels/notification-channels-tab.tsx` — Bark channel list and registration composition.
- `upgrade-alerts/upgrade-alerts-tab.tsx` — active-upgrade preparation policy list and item coordination.
- `village-settings/village-settings-tab.tsx` — large-list master/detail village editor composition.
- `group-order-tab.tsx` — tag-group ordering controls.
- `settings-layout.tsx` — meaningful surface and field-placement variants.
- `settings-dialogs.tsx` — deletion and resource-state dialogs.
- `use-api-request.ts` — authenticated JSON request behavior for Settings APIs.
- `use-mutation-feedback.ts` — shared Settings mutation refresh, pending, success, and error orchestration.
