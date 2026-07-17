# Multi Village Command Center

A responsive dashboard for tracking builders, research slots, active upgrades, and iOS Bark notifications across multiple Clash of Clans villages. It combines pasted game-export JSON and optional automated collection in PostgreSQL.

## Features

- Builder, laboratory, pet, Builder Base, and upgrade completion status for every village
- Account-tag groups with server-stored group ordering
- Optional sorting of villages that can start an upgrade
- Automatic review of game-export JSON, clipboard paste, and global Quick Paste
- PostgreSQL-backed Bark scheduling and retries based on each village's resource status
- Mobile sticky section tabs, bottom import action, and village-settings shortcuts
- Korean and English UI, plus per-village history backup and restore

## Quick start

Requires Node.js 24, pnpm, Docker, and just. mise can install the toolchain.

```bash
cp docker/.env.example docker/.env
# Change ADMIN_TOKEN, POSTGRES_PASSWORD, and BARK_DEVICE_KEY in docker/.env.
mise install
just setup
just ui
```

Open `http://localhost:3000`, then sign in with `ADMIN_TOKEN` under `Settings → Update Data`. Pasted export JSON identifies an existing village by player tag; only a new tag requires a display name.

`just ui` runs PostgreSQL in Docker and Collector, Notifier, and Next.js as local development processes. Use `just ui 3001` to change the dashboard port, or run everything in Docker with `just up`. Default addresses are `http://localhost:3000` for the dashboard and `http://localhost:8787` for Collector.

## Documentation

- [Dashboard and settings guide](docs/dashboard-guide.md): tag groups, display options, Quick Paste, alerts, and mobile workflows
- [Village data update flow](docs/village-data-flow.md): export validation, identifiers, slot calculation, and safeguards
- [Resource-aware notification policy](docs/resource-notification-policy.md): resource states, preparation time, scheduling, and deduplication
- [Operations guide](docs/operations.md): environment, commands, retention, backup, deployment, and API
- [Test contracts and documentation links](docs/testing.md): regression-test rationale, source requirements, automation gaps, and change rules

## Repository layout

| Path | Responsibility |
| --- | --- |
| `apps/dashboard` | Responsive Next.js dashboard and admin UI |
| `packages/collector` | Push/Pull collection, game exports, official Player API enrichment, and HTTP API |
| `packages/notifier` | PostgreSQL notification queue consumer and Bark delivery |
| `packages/database` | Schema and account, upgrade, notification, and history stores |
| `packages/shared` | Snapshot normalization, account tags, and JSONL utilities |
| `packages/upgrade-availability` | Display-slot calculation, including Goblin Builder and Researcher inference |

Collector and Notifier communicate through `tracked_upgrades` and `upgrade_notifications`. They may run on separate hosts but must share PostgreSQL. Collector applies schema migrations at startup.

## Common commands

```bash
just ui                 # DB plus local development services
just up                 # all services in Docker
just down               # stop Docker services
just logs collector     # service logs
just status             # Collector status
just sources            # collection and official API status by account
just data export        # back up all village history
just data import --path .local/village-history
just check              # tests, lint, and Compose validation
```

Direct pnpm commands include `pnpm typecheck`, `pnpm test`, and `pnpm --filter @multi-coc/dashboard lint`.

## Development principles

- Before changing behavior or regression tests, read the [test-contract guide](docs/testing.md) and [repository working agreement](AGENTS.md).
- Store accounts, group order, and notification settings in PostgreSQL, not environment variables.
- Keep secrets only in `docker/.env` or package-specific `.env` files; never put them in `NEXT_PUBLIC_*`.
- Use player tags for game-data matching and UUIDs for internal DB relations and API paths.
- Do not invent current resource quantities that the official API and game export do not provide.
- Enable demo fallback only with `NEXT_PUBLIC_DEMO_MODE=true`.
