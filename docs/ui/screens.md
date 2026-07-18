# Screen Inventory

## Persistent App Shell

The App Shell surrounds every route and must remain mounted during client-side navigation.

Purpose:

- establish product identity and global navigation;
- expose synchronization health, locale, installation, and Quick Paste from anywhere;
- keep route transitions spatially stable.

Critical elements:

- Dashboard, History, and Settings navigation with a persistent active state;
- Quick Paste global action;
- PWA installation action when available;
- synchronization status and last refresh information;
- locale switcher.

Important behavior:

- route content changes without remounting or moving the shell;
- keyboard focus is visible;
- narrow screens can reach every action without page-level horizontal overflow;
- the fast import action preserves the user's context unless the review genuinely needs the full Update Data screen;
- global Toast feedback renders above route content but does not change layout.

## Dashboard — `/`

Purpose: answer “which village can start work now, what is currently upgrading, and what finishes next?” across all
villages.

Primary tasks:

- identify free Home Village and Builder Base slots;
- find villages requiring a fresh export;
- inspect active upgrade load and completion timing;
- open one village or its relevant history/settings.

Critical information, in priority order:

1. update-needed and stale-data warnings;
2. free builders, laboratories, Pet House, and Builder Base capacity;
3. active work count, remaining slots, and next completion;
4. village identity using configured Display Name, tag groups, and color;
5. completion chart and queue details.

Main controls:

- tag group and availability filters;
- update-needed filter;
- display/inference options;
- Villages and Queue section navigation;
- village card, history, settings, and fast import actions.

Required states: initial loading, retryable initial error, stale cached data, empty filter result, no
villages, no active upgrades, narrow/mobile layout, and time-based countdown updates.

## Village detail — `/villages/<uuid>`

Purpose: inspect one village without mixing its data with global totals.

Critical information:

- Display Name, player tag, Town Hall and player level;
- builder and research availability for both bases;
- active upgrades and finish times;
- official trophies, league, war, donation, and Clan Capital statistics when available;
- Clock Tower and helper availability;
- helper and Hero Equipment identities and levels.

Main actions: back to Dashboard, open history already filtered to the village, and open that village's settings.

Hide information that cannot be derived or is absent. Empty optional sections are not placeholders for unsupported game
data.

## Upgrade History — `/history/upgrades`

Purpose: show work detected in exports over time without claiming whether inactive work completed or was cancelled.

Critical information: village, upgrade identity, base, type, levels, observed timing, and active/inactive state.

Main controls: village, base, active state, and type filters plus cursor-based Load more. A village detail link may enter this
route with a village query already selected.

Required states: loading, retry, stale cached data, empty result, pagination pending, and invalid/missing village.

## Sync History — `/history/syncs`

Purpose: answer when each village export was recorded and what broad state that export contained.

Critical information: Display Name, player tag, game export time, server import time, Town Hall, builders, Home/Builder Base
upgrade counts, and unknown data count.

Main controls: village filter and Load more. The screen does not claim which person synchronized because admin access has no
individual user identity.

## Update Data — `/settings/paste`

Purpose: provide the complete, deliberate workflow for importing game export JSON and reviewing its effect before saving.

Primary flow:

1. paste text or explicitly read the clipboard;
2. validate and preview;
3. review changes against the previous export;
4. supply a Display Name only for a new player tag;
5. import;
6. answer the resource-status follow-up when active work requires it.

The full page remains useful for direct links, troubleshooting, large reviews, and repeated administration. Global Quick
Paste reuses the same parsing, preview, and mutation behavior inside a Dialog instead of navigating here.

Critical information: matched/new village, exported time, detected changes, slots, upgrades, unknown identifiers, validation
errors, and current/next step. Completed steps are visually secondary and focus moves to the next required control.

## Upgrades & alerts — `/settings/upgrades`

Purpose: tune resource-preparation reminders for active upgrades without changing unrelated alert kinds.

Critical information: village, upgrade, finish time, inherited village policy, and current override.

Main actions: inherit village time, disable preparation for one upgrade, set custom minutes, save, and open corresponding
village settings.

## Village settings — `/settings/villages` and `/settings/villages/<uuid>`

Purpose: manage village identity, tags, color, player tag, resource policy, and deletion.

The UUID route selects a village directly and must survive reload. The settings list and editor must make the selected
village obvious on mobile and desktop.

Deletion is destructive and requires a confirmation Dialog. Saving uses immediate pending feedback followed by Toast
success or error feedback.

## Group settings — `/settings/groups`

Purpose: order tag-based Dashboard groups without changing the tags assigned to villages.

Critical information: current order and groups observed from village tags. Movement controls must be understandable without
drag-and-drop and accessible from a keyboard.

## UI Lab — separate development app

Routes: `/`, `/components`, and `/patterns` within `apps/ui-lab`.

Purpose: compare tokens and owned component states without Dashboard data, and verify persistent App Router layout behavior
on desktop and mobile. UI Lab never owns a production component implementation.
