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
| `ADMIN_TOKEN` | none | Admin API and Settings authentication |
| `POSTGRES_PASSWORD` | none | PostgreSQL password; not an admin login token |
| `DATABASE_URL` | none | PostgreSQL connection string for standalone services |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | local defaults | Individual DB settings when `DATABASE_URL` is absent |
| `DATA_DIR` | `/data` | Collector JSONL and `latest.json` storage |
| `PORT` | `8787` | Collector HTTP port |
| `CORS_ORIGIN` | `*` | Allowed dashboard origin; restrict in production |
| `PROFILE_REFRESH_INTERVAL_SECONDS` | `300` | Official Player API refresh interval |
| `SNAPSHOT_RETENTION_DAYS` | `90` | JSONL and DB snapshot retention; `0` disables cleanup |
| `CLASH_OF_CLANS_API_TOKEN` | none | Official developer Player API server key |
| `CLASH_OF_CLANS_API_BASE` | Supercell API | Compatible proxy or test base URL |
| `BARK_DEVICE_KEY` | none | Bark device key required by Notifier |
| `BARK_BASE_URL` | `https://api.day.app` | Bark API base URL |
| `BARK_GROUP` | `Clash Upgrades` | Bark notification group |
| `NOTIFICATION_LOCALE` | `ko` | Bark copy language: `ko` or `en` |
| `NOTIFIER_INTERVAL_SECONDS` | `10` | DB queue polling interval |
| `NEXT_PUBLIC_API_BASE` | current host on `:8787` | Collector URL used by the browser |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public metadata URL |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Enable demo fallback after Collector failure |

Only a server key from the official developer site belongs in `CLASH_OF_CLANS_API_TOKEN`.

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

```text
https://coc.example.com/* → gateway:3000
gateway /api/*            → collector:8787
gateway everything else   → dashboard:3001
```

Build the dashboard with:

```dotenv
NEXT_PUBLIC_SITE_URL=https://coc.example.com
NEXT_PUBLIC_API_BASE=same-origin
CORS_ORIGIN=https://coc.example.com
```

`same-origin` makes browser requests use `/api/*` instead of assuming port 8787. The repository gateway preserves the `/api` prefix because Collector routes include it. An outer reverse proxy only needs to forward the canonical origin to gateway port 3000; it does not need path-specific routing.

Multiple proxy layers are supported. The outermost proxy terminates public HTTPS and sets the original `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto=https`, and client forwarding headers. Intermediate proxies must preserve those values instead of replacing HTTPS with their internal HTTP hop. The repository gateway routes `/api/*` to Collector and everything else—including `/manifest.webmanifest`, `/sw.js`, icons, and `/_next/*`—to Dashboard, and forwards WebSocket upgrades for the development server.

Do not publish the application under a path prefix such as `/coc` without also introducing a matching Next.js `basePath` and service-worker scope. A dedicated hostname is the supported deployment shape. Restart or rebuild Dashboard after changing `NEXT_PUBLIC_*` values because they are embedded in the client bundle.

## Collection paths

<!-- contract: API-PROFILE-001 -->

| Path | Identity/authentication | Purpose |
| --- | --- | --- |
| Game export | JSON player tag plus admin auth | Routine upgrade and slot refresh |
| Official Player API | Global server token | Enrich name, tag, Town Hall, and experience level |

Detected upgrades merge into `tracked_upgrades`. Duplicate timers for the same village, item, and next level are cancelled; missing active entries become complete or cancelled according to completion time.

## Data storage and retention

<!-- contract: OPS-HISTORY-001 -->
<!-- contract: OPS-RETENTION-001 -->

PostgreSQL stores accounts, group order, exports, snapshots, upgrades, and notification state. Notification kinds include completion, one-minute, resource preparation, and the 24-hour stale-village `refresh_required` reminder. Independent snapshot copies use UTC-dated paths:

```text
/data/accounts/<account-uuid>/latest.json
/data/accounts/<account-uuid>/snapshots/YYYY-MM-DD.jsonl
```

Collector performs retention cleanup once at startup and every six hours. Notifier reads PostgreSQL only.

## Backup and restore

```bash
just data export
just data export --village '#GRG2VGRQ9'
just data import --path .local/village-history
just data seed
just data reseed        # stop just dev first; recreates the development DB
```

Backups include display name, player tag, color, account tags, resource policy, snapshots, and exports. Import matches existing accounts by player tag without overwriting current settings, restores resource settings only for new accounts, and skips duplicate history records.

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

## API

Public and collection endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Collector, DB, and admin configuration status |
| GET | `/api/sources` | Official Player API status by account |
| GET | `/api/dashboard` | Latest villages and group order |
| GET | `/api/history?account=<uuid>&limit=100` | Recent snapshots, up to 500 |

Admin Bearer authentication is required for account CRUD, resource status, dashboard settings, tracked upgrades, and village-export preview/import under `/api/admin/*`.

Use a TLS reverse proxy and restrict `CORS_ORIGIN` in production. Clipboard-based Quick Paste requires HTTPS outside localhost.

## Localization

UI locales are `ko-KR` and `en-US`; selection is stored in a cookie. Messages live in `apps/dashboard/messages/<locale>.json`, with supported locales in `apps/dashboard/app/i18n-config.ts`. Bark language is configured separately through `NOTIFICATION_LOCALE=ko|en`.
