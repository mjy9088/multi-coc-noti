# Overview

`packages/database`

## Purpose

PostgreSQL ownership boundary. This package defines durable schema and exposes repositories/use cases to runtimes without
making Collector, Notifier, or Dashboard depend on SQL details.

## Main files and folders

- `schema.ts` — canonical Drizzle table and relation definitions.
- `drizzle/` — ordered generated/curated SQL migrations for fresh and existing databases.
- `migrate.ts` and `drizzle.config.ts` — migration runner and Drizzle Kit configuration.
- `client.ts` — PostgreSQL/Drizzle connection construction.
- `repositories/` — aggregate-oriented SQL access for accounts, auth, dashboard settings, channels, upgrades, and exports.
- `use-cases/` — transaction and workflow boundaries for account policy, upgrade tracking, village history, scheduling, and
  delivery claims/results.
- `auth-adapter.ts` — Auth.js database adapter used by Dashboard server code.
- `types.ts` — public database-facing types shared by repositories and consumers.
- `index.ts` — compatibility/public facade. New behavior should normally be implemented in a repository or use case and
  re-exported here rather than adding more unrelated SQL directly.
- `test/` — PostgreSQL integration contracts; they skip when no test database is available.
- `legacy-schema.sql` — compatibility fixture/input for migration verification, not the current schema source.

## Choosing a location

- Single aggregate read/write: `repositories/`.
- Transaction spanning repositories or encoding workflow state transitions: `use-cases/`.
- Pure timing or domain calculation without persistence: the relevant policy package, not Database.
- HTTP validation/response shaping: Collector, not Database.
- Bark request construction: Notifier, not Database.

Schema changes require an updated Drizzle migration and must preserve the migration, ownership-isolation, history, and
notification-delivery contracts registered in `docs/testing.md`.
