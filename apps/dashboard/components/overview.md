# Overview

`apps/dashboard/components`

## Purpose

Product-owned UI and workflow implementations composed from `@multi-coc/ui`. Components here may know translations,
product models, and routes, while generic visual behavior remains in the shared UI package.

Direct files own cross-feature product adapters such as the TanStack Query provider and keys, translated request states,
date/duration formatting, and shared upgrade-availability presentation. This layer must not import upward from `app/`.

## Subfolders

- `charts/` — chart-only layout adapters.
- `dashboard/` — Dashboard overview, queue, village cards, and village detail.
- `history/` — upgrade and sync history surfaces.
- `layout/` — persistent shell and cross-route product styling.
- `settings/` — Settings workflows, models, sections, dialogs, and village editing.
