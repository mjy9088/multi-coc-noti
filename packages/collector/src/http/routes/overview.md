# Overview

`packages/collector/src/http/routes`

## Purpose

Collector endpoint groups. Route modules parse HTTP inputs, call Collector use cases or Database facades, and shape stable
responses without embedding SQL.

## Key files

- `read-routes.ts` — authenticated dashboard, source, upgrade-history, and sync-history reads plus health.
- `settings-routes.ts` — import and user-owned village, dashboard, channel, and alert-setting mutations.
