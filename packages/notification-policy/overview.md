# Overview

`packages/notification-policy`

## Purpose

Pure notification scheduling policy. It resolves village defaults and per-upgrade overrides into future preparation,
completion, and stale-data notification plans without accessing PostgreSQL or Bark.

## Key files

- `index.ts` — public policy types and planning functions.

## Subfolders

- `test/` — documented scheduling and override contracts.
