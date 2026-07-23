# Overview

`apps/dashboard/components/settings/import-data`

## Purpose

Village export import presentation. The tab composes an explicit paste, review, and optional resource-status flow; request
and workflow state remain owned by the Settings coordinator.

## Key files

- `import-data-tab.tsx` — import-flow composition and state selection.
- `import-paste-step.tsx` — export input and automatic/manual review actions.
- `import-review-step.tsx` — matched-village summary, upgrade preview, and confirmation.
- `import-preview-changes.tsx` — previous-export change summary.
- `resource-status-prompt.tsx` — post-import resource-status question.
