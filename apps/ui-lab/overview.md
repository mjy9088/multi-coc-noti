# Overview

`apps/ui-lab`

## Purpose

Disposable design-review and component-catalogue application. Use it to inspect shared primitives, responsive composition,
route persistence, and exceptional states before coupling a design to live product data.

## App routes

- `app/components/` — inventory and state examples for exported `@multi-coc/ui` components.
- `app/patterns/` — reusable interaction/layout patterns, including nested scroll ownership.
- `app/compositions/` — information hierarchy and component-placement studies for major product surfaces.
- `app/flows/` — fixture-only scenario flows with viewport, latency, selection, empty, error, and large-data variants.
- `app/lab-shell.tsx` — persistent catalogue navigation used to check route transitions.
- `app/styles/ui-lab.css` — Lab-only workbench styling; production component styling does not move here.

## Boundary

UI Lab imports shared UI primitives but does not call Collector, import Dashboard feature state, or become the canonical
product implementation. Once a composition is accepted, implement it in Dashboard or `packages/ui` and keep only the
useful review fixture here.

Run with `just dev-ui`; verify route persistence with `pnpm test:ui`.
