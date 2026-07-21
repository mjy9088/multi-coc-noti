# Overview

`.`

## Purpose

Use this map to find the owning runtime or package before opening individual files. Product behavior is documented under
`docs/`; these overview files explain code ownership and dependency boundaries.

## Top-level folders

- [`apps/`](apps/overview.md) — browser-facing Next.js applications: the product Dashboard and the isolated UI Lab.
- [`packages/`](packages/overview.md) — backend runtimes, persistence, domain calculations, shared models, and UI primitives.
- `docs/` — normative feature, operations, testing-contract, and UI architecture documentation. Start with
  [`README.md`](README.md) for the document index and [`docs/testing.md`](docs/testing.md) before changing behavior.
- `docker/` — container images, production entrypoints, and environment examples used by Compose.
- `scripts/` — repository quality checks, UI contract lint rules, and development-process helpers.
- `data/` — non-secret checked-in data inputs. Runtime state and backups belong under ignored `.local/` instead.

## Root files

- `Justfile` and `data.just` — operator-facing development, production, and local seed/backup commands.
- `docker-compose.yml` — production-style service assembly and the single public gateway port.
- `package.json` and `pnpm-workspace.yaml` — workspace scripts and package membership.
- `AGENTS.md` and `docs/testing.md` — mandatory behavior/document/test contract workflow.
- `biome.json`, `lefthook.yml`, and `scripts/` — formatting, pre-commit, ESLint-adjacent, and CSS architecture enforcement.
- `mise.toml` — pinned local toolchain.

## Runtime path

```text
browser
  -> reverse-proxy
       -> dashboard       Auth.js and pages
       -> collector       application API and health

collector -> database <- notifier
                ^
                |
           maintenance
```

Pure packages such as `village-export`, `upgrade-availability`, and `notification-policy` provide calculations to these
runtimes and should not acquire server, database, or React concerns.

## Where to start

- Change a page or interaction: [`apps/dashboard/overview.md`](apps/dashboard/overview.md)
- Develop or review shared UI: [`apps/ui-lab/overview.md`](apps/ui-lab/overview.md), then `packages/ui`
- Change an HTTP endpoint or export ingestion: `packages/collector`, then `docs/village-data-flow.md`
- Change schema or persistence behavior: [`packages/database/overview.md`](packages/database/overview.md)
- Change notification timing: `packages/notification-policy`; delivery: `packages/notifier`
- Change deployment or routing: `packages/reverse-proxy`, `docker/`, and `docs/operations.md`

`pnpm check:overviews` validates the maintained maps' path markers, declared subfolders, and local Markdown links.
See [`docs/overview-maintenance.md`](docs/overview-maintenance.md) before adding, moving, or substantially changing an
`apps/` or `packages/` directory.
