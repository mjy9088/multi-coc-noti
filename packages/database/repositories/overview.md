# Overview

`packages/database/repositories`

## Purpose

Aggregate-oriented Drizzle queries. Repositories own SQL details for one persistence area; transactions and state
transitions spanning areas belong in `use-cases/`.

## Areas

- accounts and user ownership;
- Auth.js users, accounts, and sessions;
- dashboard display/group settings;
- notification channels;
- tracked upgrades and notification rows;
- raw village exports and sync history.

