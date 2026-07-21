# Overview

`packages/database/use-cases`

## Purpose

Transactional persistence workflows spanning repositories or encoding durable state transitions.

## Areas

- account policy and ownership-scoped mutations;
- upgrade tracking and projection replacement;
- village history export/import restoration;
- notification scheduling, claiming, delivery results, and channel-aware delivery.

Pure notification timing remains in `@multi-coc/notification-policy`.

