# Overview

`packages/collector/src/http`

## Purpose

HTTP boundary for Collector. Owns Hono application assembly, authenticated request context, validation-to-response mapping,
and route registration; business persistence remains in use cases and Database.

## Subfolders

- `routes/` — endpoint groups mounted by the app factory.

## Key files

- `app.ts` — Hono app factory and cross-route middleware.
- `context.ts` — request context and dependency types.

