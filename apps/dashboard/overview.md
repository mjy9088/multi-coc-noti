# Overview

`apps/dashboard`

## Purpose

Next.js product application. It owns authentication UI, routes, browser-side data fetching, translated presentation, PWA
metadata, and product-specific component composition. Collector owns application APIs and Database owns persistence.

## Subfolders

- `app/` — App Router entries, persistent layouts, providers, route parameter adapters, and small browser integration
  helpers. Feature implementations should not grow here merely because a route imports them.
- `components/` — product-owned Dashboard, History, Settings, chart, and persistent-shell composition with adjacent CSS.
- `i18n/` — next-intl request wiring.
- `messages/` — Korean and English message catalogues.
- `public/` — icons, manifest-related images, and the service worker.
- `test/` — fast Dashboard unit tests.
- `tests/` — Playwright route and layout contracts.
- `types/` — application-level ambient type augmentation such as Auth.js session fields.

## Component areas

- `components/dashboard/` — overview, filters, village cards, queue, and village detail with owned CSS.
- `components/history/` — upgrade/sync history navigation, queries, results, and composition.
- `components/settings/` — Settings workflow, models, sections, dialogs, village editor, typed layout adapters, and owned CSS.
- `components/charts/` — chart-specific composition shared by Dashboard chart views.
- `components/layout/` — persistent App Shell and History surface styling.

## Main entry points

- `app/layout.tsx` — authentication/session boundary and persistent providers.
- `app/app-shell.tsx` — global navigation, Quick Paste, locale, and PWA shell.
- `app/page.tsx` — Dashboard query and route orchestration; presentation lives in `components/dashboard`.
- `components/settings/settings-panel.tsx` — Settings loading, mutations, import/review workflow, and section assembly.
- `components/history/*-panel.tsx` — URL-backed history query surfaces.
- `auth.ts` and `proxy.ts` — Auth.js configuration and request protection.

## Ownership rules

- Route files should validate or translate route state and delegate coherent UI/workflows to feature components.
- Product CSS lives beside its owning feature and is imported by that feature entry point. `app/globals.css` is only the
  shared foundation plus temporary legacy compatibility.
- Keep a wrapper only when it provides a semantic variant, repeated behavior, accessibility contract, or meaningful
  composition. Do not wrap a primitive solely to pass one fixed class.
- Generic controls, layouts, feedback, and scroll behavior belong in `@multi-coc/ui`; game-specific models and labels remain
  here.
- API requests use the same-origin Collector routes and include credentials. Do not access Database directly from client
  components; the Auth.js adapter is the server-side exception.

## Verification

- `pnpm --filter @multi-coc/dashboard lint`
- `pnpm --filter @multi-coc/dashboard typecheck`
- `pnpm --filter @multi-coc/dashboard test:e2e`
- Run root `pnpm test` before handoff when behavior or shared structure changes.
