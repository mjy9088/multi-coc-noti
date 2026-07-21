# Overview

`packages/notifier`

## Purpose

Notification delivery runtime. It claims due database rows, resolves kind-specific Bark presentation, sends channel-aware
requests, and records success or retry state.

## Subfolders

- `src/` — Notifier loop, Bark adapter, and process entry.
- `test/` — copy, presentation, delivery, and retry tests.

Scheduling decisions belong in `notification-policy` and Database use cases, not in the delivery loop.

