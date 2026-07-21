# Overview

`packages/collector`

## Purpose

Authenticated Hono application serving product APIs. It coordinates export ingestion, dashboard/history reads, official
Player API enrichment, settings mutations, and notification rescheduling through Database use cases.

## Subfolders

- `src/` — HTTP assembly, routes, services, and Collector use cases.
- `test/` — fast HTTP, API adapter, shared-utility, and documentation-contract tests.

`src/server.ts` is the process entry point; HTTP construction is separated so tests can exercise the app without listening.

