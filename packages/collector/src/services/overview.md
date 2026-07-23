# Overview

`packages/collector/src/services`

## Purpose

External-input adapters used by Collector workflows. Keep network-specific and raw-export concerns here rather than in
routes or persistence code.

## Key files

- `clash-api.ts` — official Player API request and response mapping.
- `collector-state.ts` — user-scoped account cache and official-profile refresh state.
