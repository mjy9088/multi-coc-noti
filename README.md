# Multi Village Command Center

A responsive dashboard for tracking builders, research slots, active upgrades, and iOS Bark notifications across multiple Clash of Clans villages. It stores pasted game-export JSON and notification state in PostgreSQL.

## Features

- Builder, laboratory, pet, Builder Base, and upgrade completion status for every village
- Completion-time bar charts and active-upgrade/available-slot area charts for Home Village and combined bases
- Per-village detail views with upgrade summaries, Clock Tower and helper cooldowns, helper levels, Hero Equipment, and optional official Player API statistics
- Account-tag groups with server-stored group ordering
- Optional sorting of villages that can start an upgrade
- Automatic review of game-export JSON, clipboard paste, and global Quick Paste
- PostgreSQL-backed Bark scheduling and retries based on each village's resource status, with per-upgrade preparation-alert overrides
- Installable PWA metadata and icons; authenticated API traffic deliberately remains network-only
- Mobile sticky section tabs, bottom import action, and village-settings shortcuts
- Korean and English UI, plus per-village history backup and restore

## Quick start

Requires mise and Docker. The repository's `mise.toml` installs the pinned Node.js, pnpm, and just toolchain.

```bash
cp docker/.env.example docker/.env
# Set POSTGRES_PASSWORD, AUTH_SECRET, and either an OAuth provider or the optional test login in docker/.env.
# Keep NEXT_PUBLIC_API_BASE=same-origin when using just dev or just prod-up.
mise install
just setup
just dev
```

Open `http://localhost:3000`, sign in with a configured provider, and add Bark devices under Upgrades & alerts.
Pasted export JSON identifies one of the current user's villages by player tag; only a new tag requires a display name.

`just dev` runs PostgreSQL in Docker and Gateway, Collector, Notifier, and Next.js as local development processes. Use `just dev 3100` to change the public gateway port, or run everything in Docker with `just prod-up`. Only the gateway uses a fixed host port; Next.js and Collector use automatically selected loopback ports.

Run the separate Next.js component and route-layout catalogue with `just dev-ui` and open `http://localhost:3100`.

## Documentation

- [Dashboard and settings guide](docs/dashboard-guide.md): charts, village details, PWA installation, tag groups, Quick Paste, alerts, and mobile workflows
- [UI architecture and screen inventory](docs/ui/README.md): screen priorities, component ownership, interaction patterns, and the design-system migration plan
- [Village data update flow](docs/village-data-flow.md): export validation, identifiers, slot calculation, and safeguards
- [Resource-aware notification policy](docs/resource-notification-policy.md): resource states, preparation time, scheduling, and deduplication
- [Authentication and user data isolation](docs/authentication.md): open social sign-in, ownership boundaries, and legacy-data claiming
- [Operations guide](docs/operations.md): environment, commands, retention, backup, deployment, and API
- [Test contracts and documentation links](docs/testing.md): regression-test rationale, source requirements, automation gaps, and change rules
- [Overview maintenance](docs/overview-maintenance.md): local ownership-map format, coverage rules, and validation

## Repository layout

Start with the [repository overview](overview.md) for a navigable ownership map, then follow the local `overview.md` in
`apps/`, `apps/dashboard`, `apps/ui-lab`, `packages/`, or `packages/database` when working in those areas.

| Path | Responsibility |
| --- | --- |
| `apps/dashboard` | Responsive Next.js dashboard and Auth.js sign-in UI |
| `apps/ui-lab` | Next.js catalogue for shared UI tokens, components, and persistent-layout route checks |
| `packages/collector` | Game exports, official Player API enrichment, and HTTP API |
| `packages/notifier` | PostgreSQL notification queue consumer and Bark delivery |
| `packages/database` | Schema and account, upgrade, notification, and history stores |
| `packages/ui` | Shared semantic tokens and owned React UI primitives |
| `packages/shared` | Shared dashboard data model and account-tag utilities |
| `packages/upgrade-availability` | Display-slot calculation, including Goblin Builder and Researcher inference |
| `packages/reverse-proxy` | Single public gateway: Auth.js routes to Dashboard, application APIs to Collector, and all other traffic to Next.js |

Collector and Notifier communicate through `tracked_upgrades` and `upgrade_notifications`. They may run on separate hosts but must share PostgreSQL. Collector applies schema migrations at startup.

Integrated development and production use one browser-facing origin:

```text
browser → gateway:3000
              ├─ /api/auth/* → Next.js Dashboard
              ├─ /api/* and /health → Collector
              └─ other → Next.js Dashboard
```

Dashboard and Collector have no production host-port publishing. The gateway preserves `/api` paths and forwards development WebSocket upgrades.

## Common commands

```bash
just dev                 # DB plus local development services
just dev 3100            # use another public development port
just prod-up             # build and run all production services in Docker
just prod-down           # stop production Docker services
just prod-logs collector # production service logs
just dev-status         # development Collector status
just data export        # back up all village history
just data import --path .local/village-history
just check              # tests, lint, and Compose validation
```

The `just data` export, import, seed, and reseed commands operate only on the local test login configured by
`AUTH_TEST_CREDENTIALS_ENABLED`, `AUTH_TEST_USERNAME`, and `AUTH_TEST_PASSWORD` in `docker/.env`.

Direct pnpm commands include `pnpm typecheck`, `pnpm test`, and `pnpm --filter @multi-coc/dashboard lint`.

## Development principles

- Before changing behavior or regression tests, read the [test-contract guide](docs/testing.md) and [repository working agreement](AGENTS.md).
- Store accounts, group order, and notification settings in PostgreSQL, not environment variables.
- Keep secrets only in `docker/.env` or package-specific `.env` files; never put them in `NEXT_PUBLIC_*`.
- Use player tags for game-data matching and UUIDs for internal DB relations and API paths.
- Do not invent current resource quantities that the official API and game export do not provide.
