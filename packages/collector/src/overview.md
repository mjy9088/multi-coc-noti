# Overview

`packages/collector/src`

## Purpose

Collector implementation split by transport, external services, and request-level workflows. Keep `server.ts` limited to
configuration and process lifecycle.

## Subfolders

- `http/` — Hono app construction, middleware context, and routes.
- `services/` — adapters for external APIs and export-input handling.
- `use-cases/` — authenticated Collector workflows composed from Database capabilities.

## Key files

- `server.ts` — runtime entry and listener lifecycle.

