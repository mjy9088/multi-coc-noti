# Overview

`apps/dashboard/components/history`

## Purpose

URL-backed upgrade and sync history UI. Owns History navigation, filters, paginated queries, result composition, and
history-specific presentation.

## Key files

- `history-nav.tsx` — persistent History tabs.
- `history-panel.tsx` — upgrade-history filters and pagination.
- `sync-history-panel.tsx` — export/import observation history.
- `upgrade-history-item.tsx` — one detected-upgrade history result.
- `sync-history-item.tsx` — one export/import history result.
- `history-model.ts` — shared History response item types.
- `history-layout.tsx` — typed History section, filter, and result-list variants.
