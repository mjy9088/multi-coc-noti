# Overview

`packages/collector/src/use-cases`

## Purpose

Request-level application workflows that combine authentication context, parsed data, and Database operations. They are
transport-independent enough for focused tests but remain Collector-owned rather than domain-pure.

## Key files

- `village-export.ts` — preview/import workflow, account input validation, and post-import scheduling.
- `get-dashboard.ts` — dashboard projection assembled from stored exports, tracked upgrades, and cached official data.
