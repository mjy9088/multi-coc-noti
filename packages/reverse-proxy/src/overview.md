# Overview

`packages/reverse-proxy/src`

## Purpose

Gateway implementation separated into pure routing choice, proxy lifecycle, and executable startup.

## Key files

- `routing.ts` — path-to-upstream selection.
- `gateway.ts` — HTTP and WebSocket forwarding with disconnect handling.
- `server.ts` — environment resolution and listener entry point.

