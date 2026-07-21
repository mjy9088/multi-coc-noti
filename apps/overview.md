# Overview

`apps`

## Purpose

Browser-facing application namespace. Applications assemble workspace packages and own routes, product workflows, and
runtime providers; reusable domain calculations and generic UI primitives stay under `packages/`.

## Subfolders

- `dashboard/` — production Next.js App Router application, Auth.js sign-in, PWA assets, product
  screens, translations, and browser E2E tests.
- `ui-lab/` — isolated Next.js catalogue for UI primitives, composition studies, scenario flows, and
  persistent-layout checks. It never calls product APIs.

Continue with [`dashboard/overview.md`](dashboard/overview.md) or [`ui-lab/overview.md`](ui-lab/overview.md).

## Boundary

Dashboard may import product and UI packages. UI Lab should depend only on `@multi-coc/ui` and fixture-local code so the
catalogue does not silently become a second product implementation.
