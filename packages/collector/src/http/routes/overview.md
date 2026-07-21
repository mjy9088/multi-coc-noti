# Overview

`packages/collector/src/http/routes`

## Purpose

Collector endpoint groups. Route modules parse HTTP inputs, call Collector use cases or Database facades, and shape stable
responses without embedding SQL.

## Key files

- `dashboard-routes.ts` — dashboard, villages, history, and related reads.
- `settings-routes.ts` — import and user-owned settings mutations.

