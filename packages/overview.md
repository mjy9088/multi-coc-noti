# Overview

`packages`

## Purpose

Workspace package map. Choose the package that owns the rule or runtime rather than importing across layers to reach a
convenient implementation detail.

## Runtime packages

- `collector/` — Hono HTTP application for authenticated product APIs, export ingestion, dashboard/history reads, official
  Player API enrichment, and notification rescheduling.
- `notifier/` — queue consumer that claims due deliveries, resolves Bark presentation, sends requests, and records
  success/retry state.
- `reverse-proxy/` — single browser-facing gateway. Routes Auth.js to Dashboard, application APIs/health to Collector, and
  pages/assets/HMR to Dashboard while tolerating normal disconnects.
- `maintenance/` — operator CLI for user-scoped JSONL village-history export, import, seed, and reseed.

## Persistence and policy packages

- [`database/`](database/overview.md) — Drizzle schema/migrations, repositories, Auth.js adapter, and persistence-oriented
  use cases for villages, upgrades, history, channels, and notification delivery.
- `notification-policy/` — pure notification scheduling and per-upgrade override resolution; it does not send notifications.
- `village-export/` — pure validation and parsing of pasted game exports into normalized village, slot, cooldown, helper,
  equipment, and upgrade data.
- `upgrade-availability/` — pure browser/display projection for inferred slots, filtering, summaries, and chart series.

## Shared packages

- `shared/` — small cross-runtime data contracts and normalization utilities used by backend and pure policy packages.
- `ui/` — generic React primitives, semantic tokens, layout/scroll/focus behavior, and public component exports. It contains
  no game-specific terminology or product queries.

## Dependency direction

```text
dashboard -> ui, upgrade-availability, database(Auth adapter only)
collector -> database, shared, village-export
notifier -> database, notification-policy
maintenance -> database, village-export
database -> shared, notification-policy
village-export -> shared
```

Pure policy/model packages should remain importable without React, PostgreSQL, HTTP servers, or environment configuration.
