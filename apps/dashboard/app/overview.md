# Overview

`apps/dashboard/app`

## Purpose

Next.js route-composition layer. It owns layouts, providers, route parameter adaptation, and thin entry files; coherent
product UI belongs under `components/`.

## Key areas

- `layout.tsx` and `app-shell.tsx` establish authentication and persistent application chrome.
- `page.tsx` orchestrates Dashboard data and delegates presentation to `components/dashboard`.
- `history/` and `settings/` provide persistent nested route layouts.
- Small hooks here adapt browser requests, formatting, mutation feedback, and route loading/error states.

