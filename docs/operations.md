# Operations Guide

## Runtime modes and environment files

Do not mix environment files between runtime modes.

| File | Used by |
| --- | --- |
| `docker/.env` | `just prod-up`, `just dev`, `just data up`, and Docker Compose |
| `apps/dashboard/.env.local` | standalone `just dev-dashboard` |
| `packages/collector/.env` | standalone `just dev-collector` |
| `packages/notifier/.env` | standalone `just dev-notifier` |

The repository does not use a root `.env`. Copy the example files and replace secrets. Values prefixed with `NEXT_PUBLIC_*` are exposed to the browser and build output.

### Important environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | none | PostgreSQL password |
| `AUTH_SECRET` | none | Auth.js session and OAuth security secret |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | none | Optional GitHub social login |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | none | Optional Google social login |
| `AUTH_TEST_CREDENTIALS_ENABLED`, `AUTH_TEST_USERNAME`, `AUTH_TEST_PASSWORD` | disabled | Optional local/test ID-password login; all three are required to enable it |
| `DATABASE_URL` | none | PostgreSQL connection string for standalone services |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | local defaults | Individual DB settings when `DATABASE_URL` is absent |
| `PORT` | `8787` | Collector HTTP port |
| `CORS_ORIGIN` | `*` | Allowed dashboard origin; restrict in production |
| `PROFILE_REFRESH_INTERVAL_SECONDS` | `300` | Official Player API refresh interval |
| `CLASH_OF_CLANS_API_TOKEN` | none | Official developer Player API server key |
| `CLASH_OF_CLANS_API_BASE` | Supercell API | Compatible proxy or test base URL |
| `NOTIFIER_INTERVAL_SECONDS` | `10` | DB queue polling interval |
| `NEXT_PUBLIC_API_BASE` | mode-dependent | Collector URL used by the browser; use `same-origin` for `just dev`, `just prod-up`, PWA, and chained reverse proxies |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public metadata URL |

Only a server key from the official developer site belongs in `CLASH_OF_CLANS_API_TOKEN`.

Configure OAuth callbacks against the one public gateway origin: `/api/auth/callback/github` for GitHub and
`/api/auth/callback/google` for Google. The gateway forwards those Auth.js paths to Dashboard even though it sends the
remaining application API paths to Collector.

`NEXT_PUBLIC_API_BASE` is embedded in the browser bundle. Integrated modes require `same-origin` because only gateway port 3000 is public and development chooses non-fixed loopback ports for Collector and Next.js. A blank value retains the standalone-dashboard fallback to the current hostname on port 8787 and is not suitable for `just dev` or `just prod-up`.

The Dashboard has no client-side demo fallback. If Collector is unavailable, it shows the normal retryable loading error;
successful empty responses show the real empty state.

## Local execution

```bash
just dev                 # DB plus all local development services
just dev 3100            # use another public gateway port; internal ports are automatic
just dev-dashboard       # standalone Next.js after creating its env file
just dev-collector       # standalone Collector
just dev-notifier        # standalone Notifier
just prod-up             # build and run all services in Docker
just prod-down           # stop production Docker services
just prod-logs collector # production service logs
```

When opening `just dev` through Tailscale or another remote origin, set its full origin in `CORS_ORIGIN` and restart the development stack. The Collector uses the value for API CORS, while the Next development server derives the hostname for `allowedDevOrigins`.

Development binds only the gateway to the requested fixed port. Next.js and Collector bind to automatically selected loopback ports. Production publishes only gateway port 3000; Dashboard and Collector are reachable by service name only within the Compose network.

## Reverse proxy chains and PWA deployment

For an installed PWA, expose one canonical HTTPS origin and route by path:

<!-- contract: OPS-PROXY-001 -->
<!-- contract: OPS-PROXY-002 -->

```text
https://coc.example.com/* → gateway:3000
gateway /api/auth/*       → dashboard:3001
gateway /api/*, /health   → collector:8787
gateway everything else   → dashboard:3001
```

Build the dashboard with:

```dotenv
NEXT_PUBLIC_SITE_URL=https://coc.example.com
NEXT_PUBLIC_API_BASE=same-origin
CORS_ORIGIN=https://coc.example.com
```

`same-origin` makes browser requests use `/api/*` instead of assuming port 8787. The repository gateway preserves the `/api` prefix because Collector routes include it. Auth.js owns `/api/auth/*` in Dashboard, while Collector owns the remaining application APIs and `/health`. An outer reverse proxy only needs to forward the canonical origin to gateway port 3000; it does not need path-specific routing.

Multiple proxy layers are supported. The outermost proxy terminates public HTTPS and sets the original `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto=https`, and client forwarding headers. Intermediate proxies must preserve those values instead of replacing HTTPS with their internal HTTP hop. The repository gateway routes `/api/auth/*` to Dashboard, other `/api/*` requests and `/health` to Collector, and everything else—including `/manifest.webmanifest`, `/sw.js`, icons, and `/_next/*`—to Dashboard. It also forwards WebSocket upgrades for the development server.

Browser navigation, cancellation, and HMR reconnection routinely close HTTP and WebSocket tunnels before an upstream has
finished writing. The repository gateway must close both halves of those tunnels without treating `EPIPE`, `ECONNRESET`,
or premature stream closure as a process-level failure, and must continue accepting later requests.

Do not publish the application under a path prefix such as `/coc` without also introducing a matching Next.js `basePath` and service-worker scope. A dedicated hostname is the supported deployment shape. Restart or rebuild Dashboard after changing `NEXT_PUBLIC_*` values because they are embedded in the client bundle.

## Collection paths

<!-- contract: API-PROFILE-001 -->

| Path | Identity/authentication | Purpose |
| --- | --- | --- |
| Game export | JSON player tag plus Auth.js user session | Routine upgrade and slot refresh |
| Official Player API | Global server token | Enrich name, tag, Town Hall, experience level, trophies, league, war stars, donations, and Clan Capital contribution |

Detected upgrades merge into `tracked_upgrades`. Internal terminal states support notification cleanup, but they are not treated as reliable evidence that a player completed or cancelled an upgrade. Public history exposes only whether each record is still active.

Package dependencies follow the runtime responsibility direction:

- `village-export` owns parsing and normalization of raw game exports. Collector uses it for HTTP import and the separate Maintenance CLI uses it when rebuilding history; Database must not import either application's internals.
- `notification-policy` owns pure alert scheduling decisions. Database persists the resulting schedule, while Notifier only delivers claimed rows.
- `shared` contains cross-package data contracts and small domain predicates without infrastructure dependencies.
- `maintenance` composes Database and domain packages for operator-facing backup, restore, validation, seed, and reseed commands.
- `database/client.ts` owns the PostgreSQL connection lifecycle and exposes the Drizzle client, `database/schema.ts` is the
  typed schema, and `database/migrate.ts` serializes migration execution. Aggregate repositories use the typed client while
  cross-aggregate use cases own transactions. Generated Drizzle migrations are authoritative for fresh databases and all
  future changes. An unjournaled existing database runs the legacy idempotent upgrade once, records the generated initial
  migration as its baseline, and then follows the same migration journal.
  `database/legacy-schema.sql` exists only for that one-time adoption path and is not the source for new schema changes.
- Collector uses Hono only as its HTTP adapter. Session-scoped route modules live under `src/http/routes`, application
  work lives under `src/use-cases`, account/profile cache lifecycle belongs to `CollectorState`, and `server.ts` only
  composes startup, migrations, timers, listening, and graceful shutdown.

## Data storage

PostgreSQL is the only runtime data store. It stores accounts, group order, raw game exports, the derived upgrade record set,
notification state, and the channel/rule records prepared for configurable delivery. Notification kinds include completion,
one-minute, resource preparation, and the 24-hour stale-village `refresh_required` reminder. Channel credentials and Bark
presentation rules are kept outside the scheduling queue so future user ownership or additional delivery channels do not
change resource-policy semantics. Channel-specific delivery rows isolate claims, success, and retries when a scheduled event
fans out to multiple recipients. Notifier selects only enabled Bark channels owned by the same user as the village; users
without a configured channel receive no Bark delivery. Collector and Notifier do not write runtime snapshot files.

<!-- contract: DB-MIGRATION-001 -->

Migration must create a fresh database from generated Drizzle SQL and must preserve application data when adopting an
existing unjournaled schema. Both paths converge on the same Drizzle migration journal before services start.

## Backup and restore

```bash
just data export
just data export --village '#GRG2VGRQ9'
just data import --path .local/village-history
just data seed
just data reseed        # stop just dev first; recreates the development DB
```

All `just data` backup and restore commands require the optional local test login to be fully enabled in `docker/.env`.
Export selects only the deterministic user for `AUTH_TEST_USERNAME`; import, seed, and reseed create or reuse that user and
attach every restored village to it. Selection and matching by player tag are restricted to that user, so another user's
village with the same tag is neither exported nor merged.

Backups are JSON Lines v2: the first line contains village metadata, resource policy, and upgrade alert settings, and each
later line contains one raw game export. Import is a development seed/restore operation: it reparses exports to rebuild
derived state, matches existing accounts by player tag within the target test user, and reapplies the header's village,
resource-policy, and included per-upgrade alert settings even when that village already exists. It merges export history,
skips identical duplicate records, and rejects conflicting records at the same timestamp. Runtime user data outside the
bundle, such as notification delivery channels, is not replaced. Legacy v1 JSON bundles remain importable; their snapshot
records are ignored.

<!-- contract: DB-HISTORY-001 -->

At the Database boundary, exporting must select only the explicit source user's villages. Restoring a village must preserve
its raw exports, reapply its backed-up village and upgrade-alert settings, attach the restore to the explicit target user
without merging another user's matching player tag, and rebuild its tracked-upgrade projection in one transaction; a failed
or conflicting restore must not leave a partial village history. Collector refreshes its account view before authenticated
API requests, so a CLI restore becomes visible to an already running Dashboard without restarting the development stack.

## Separate Notifier deployment

<!-- contract: ALERT-DELIVERY-001 -->
<!-- contract: ALERT-DELIVERY-002 -->

Collector must apply DB migrations first. A separate Notifier must connect to the same PostgreSQL.

```bash
docker build -f docker/Dockerfile --target services -t multi-coc-services .
docker run -d --name coc-notifier --restart unless-stopped \
  --env-file packages/notifier/.env \
  multi-coc-services node packages/notifier/src/notifier.ts
```

Notifier atomically claims due rows. Success records `sent`; failure records the error and next retry time. Leases and DB constraints prevent duplicate claims across processes.

<!-- contract: DB-NOTIFICATION-001 -->

Database claiming must give a due notification to only one worker. A resource reminder claim reserves the village-level
suppression window atomically, and recording delivery failure releases that reservation before scheduling a retry. Managed
channels fan out once per scheduled event, claim each channel delivery exclusively, and record success or retry without
changing another channel's delivery state.

## API

Public and collection endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Collector and DB status |
| GET | `/api/sources` | Official Player API status by account |
| GET | `/api/dashboard` | Latest villages and group order |
| GET | `/api/upgrades?limit=100&before=<id>` | Export-detected upgrade records across villages, newest first; filterable by village, base, status, and type |
| GET | `/api/syncs?limit=100&before=<id>` | Stored village-export sync records, newest first; filterable by village |
| GET | `/api/villages/<uuid>/upgrades?limit=100&before=<id>` | Export-detected upgrade records, newest first; up to 500 |

All application `/api/*` endpoints require an Auth.js database session. There is no administrator API or shared bearer
token. Village CRUD, settings, history, export preview/import, and notification channels are scoped to the signed-in user.

Dashboard route `/villages/<uuid>` currently resolves its village from the aggregate `/api/dashboard` response. Settings use `/settings/paste`, `/settings/upgrades`, `/settings/villages`, `/settings/villages/<uuid>`, and `/settings/groups`; `/settings` redirects to `/settings/paste`. History uses `/history/upgrades` and `/history/syncs`, while the UUID upgrade resource path above supports village-scoped reads. A village-detail endpoint can be introduced separately if the aggregate response becomes unsuitable.

Use a TLS reverse proxy and restrict `CORS_ORIGIN` in production. Clipboard-based Quick Paste requires HTTPS outside localhost.

## Localization

UI locales are `ko-KR` and `en-US`; selection is stored in a cookie. Messages live in
`apps/dashboard/messages/<locale>.json`, with supported locales in `apps/dashboard/app/i18n-config.ts`. Each Bark channel
stores its own notification language.
