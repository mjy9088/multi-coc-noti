# Overview

`packages/ui/src/components`

## Purpose

Generic UI component implementations. Components own accessibility, internal state contracts, and recurring geometry;
product data and feature-specific class mappings stay in applications.

## Subfolders

- `data-display/` — cards, lists, statistics, entity headers, and empty/request states.
- `layout/` — page, section, toolbar, split-pane, scroll, sticky-stack, and route-frame composition.

Direct files cover dialogs, disclosure, feedback, fields/forms, inputs, selection, tabs, toggles, and tooltips. Action bars,
split layouts, and measured sticky stacks live under `layout/` with the geometry they coordinate.
