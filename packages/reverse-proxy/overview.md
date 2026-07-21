# Overview

`packages/reverse-proxy`

## Purpose

Single browser-facing gateway for development and production. It separates Auth.js, application API/health, and Dashboard
traffic and absorbs expected HTTP/WebSocket disconnect errors.

## Subfolders

- `src/` — routing policy, proxy implementation, and process entry.
- `test/` — routing and disconnect regression contracts.

