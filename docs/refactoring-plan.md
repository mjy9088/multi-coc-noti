# Incremental Backend Refactoring Plan

This is a temporary implementation plan for keeping package boundaries stable while Database and Collector are split
incrementally. Remove it after the target structure is established and the durable architecture is documented in the
feature and operations guides.

## Database

The intended structure is a Drizzle-backed persistence layer grouped first by aggregate, with use cases owning
cross-aggregate orchestration and transaction boundaries.

1. Keep connection lifecycle in `packages/database/client.ts` and migration execution in
   `packages/database/migrate.ts`.
2. Introduce Drizzle's `node-postgres` client and typed schema without changing the public Database API.
3. Move simple aggregates first: accounts, dashboard settings, village exports, upgrades, then notifications.
4. Put single-aggregate reads and writes in aggregate repositories.
5. Move operations such as saving an export, synchronizing upgrades, rescheduling alerts, and importing history into
   use-case modules. These modules, rather than repositories, own multi-aggregate transactions.
6. Reduce `packages/database/index.ts` to the intentionally supported public facade.
7. Adopt generated Drizzle migrations as the schema source of truth only after verifying them against the existing
   production schema and backup/restore flow.

Complex SQL may remain typed raw SQL where translating it to a query builder would make its intent less clear.

## Collector

The intended structure separates HTTP transport, application use cases, external services, and process startup.

1. Keep body parsing, authentication, response formatting, and later error mapping under `src/http`.
2. Extract dashboard assembly, export preview/import, and official-profile refresh into independently callable use cases.
3. Replace process-global account and profile maps with explicit service objects whose lifecycle is composed at startup.
4. Move endpoint matching into route modules after the use cases no longer depend on `IncomingMessage` or
   `ServerResponse`.
5. Reduce `server.ts` to configuration, dependency composition, migration, timers, listen, and shutdown.
6. Consider replacing only the routing/HTTP adapter with Hono after these boundaries exist; do not combine the framework
   migration with business-logic extraction.

Throughout the migration, Database remains an infrastructure dependency of application use cases, while pure export
parsing and notification policy remain independent domain packages.
