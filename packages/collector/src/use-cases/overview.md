# Overview

`packages/collector/src/use-cases`

## Purpose

Request-level application workflows that combine authentication context, parsed data, and Database operations. They are
transport-independent enough for focused tests but remain Collector-owned rather than domain-pure.

## Key files

- `import-village-export.ts` — preview/import workflow and post-import scheduling.
- `refresh-official-profiles.ts` — official profile enrichment orchestration.

