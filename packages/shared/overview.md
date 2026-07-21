# Overview

`packages/shared`

## Purpose

Small cross-runtime data contracts and normalization helpers shared by Collector, Database, export parsing, and policy
packages. Keep this package dependency-light and free of HTTP, PostgreSQL, React, and environment access.

`index.ts` is the public surface; split it only when independent shared responsibilities become large enough to name.

