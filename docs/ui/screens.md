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

Implementation status: the production shell uses semantic route links and owned Button/token styling. At narrow widths its
primary navigation owns horizontal scrolling on a stable second row, while global tools remain beside the product identity.
Settings and History own persistent nested layouts, so URL-backed tab changes do not remount their authentication, heading,
navigation, or cached client state. Their route-loading boundaries leave the mounted shell visible instead of replacing it
with a full-page loading screen.

Route tabs remain fully visible immediately below the App Shell while scrolling; page titles and descriptions may leave the
viewport. A navigation strip must be either intentionally visible or intentionally hidden, never partially covered by
another sticky layer. Sticky stack offsets are semantic shell-owned variables rather than repeated local calculations.
The shared sticky stack measures the App Shell and route wrapper, so horizontal overflow does not change the vertical
sticky containing block and viewport-bounded content uses the actual remaining height rather than a duplicated estimate.
<!-- contract: UI-SETTINGS-001 -->

All Settings destinations share one viewport frame below the sticky tabs. The outer document scrolls only until that frame
reaches the sticky stack; afterward, long destination content scrolls inside the frame. Short destinations retain their
natural content height without a synthetic blank tail, while Village Settings fills the same frame with its list/editor
layout. Pointer scrolling over route content follows the same ownership handoff instead of being trapped by the not-yet-fixed
frame. Route changes reset only the frame's internal scroll position.

## Dashboard — `/`

<!-- contract: UI-ROUTES-001 -->

Dashboard, village detail, and both History routes compose the owned UI primitives for actions, fields, cards, badges,
request states, and tabs. Their product-specific charts, metrics, and result rows use semantic tokens and must not create
page-level horizontal overflow at supported desktop or mobile widths.

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

Main controls: village filter and Load more. The screen does not repeat the signed-in user's identity on every record.

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
Paste reuses the same parsing, preview, mutation, and resource-policy follow-up behavior inside a Dialog instead of
navigating here. Closing it preserves the originating route and scroll context.

Critical information: matched/new village, exported time, detected changes, slots, upgrades, unknown identifiers, validation
errors, and current/next step. Completed steps are visually secondary and focus moves to the next required control.

## Upgrade alerts — `/settings/upgrades`

Purpose: tune resource-preparation reminders for active upgrades without changing unrelated alert kinds.

Critical information: village, upgrade, finish time, inherited village policy, and current override.

Main actions: inherit village time, disable preparation for one upgrade, set custom minutes, save, and open corresponding
village settings.

## Notification channels — `/settings/notification-channels`

Purpose: manage where notifications are delivered, independently from the content and timing policy applied to upgrades.

Critical information: channel name, masked Bark device identity, endpoint, and notification language.

Main actions: add a Bark channel and remove an existing channel. Delivery-channel settings must not be mixed into the
upgrade-alert list because changing a recipient and changing an upgrade policy have different scope and consequences.

## Village settings — `/settings/villages` and `/settings/villages/<uuid>`

Purpose: manage village identity, tags, color, player tag, resource policy, and deletion.

The UUID route selects a village directly and must survive reload. The settings list and editor must make the selected
village obvious on mobile and desktop. On mobile, the village list fills the available master pane and scrolls internally;
selecting a village opens the editor sheet without leaving a large unused area below a capped list.
The list supports searching dozens of villages by Display Name, player tag, or group tag.

On desktop, the village list and editor share one viewport-bounded pane height. Each pane owns its content scrolling so a
long list or form cannot make the two surfaces diverge in height, and the editor ActionBar remains available at its bottom.
Before the Settings route frame reaches its sticky position, pointer input over either pane continues scrolling the outer
page. Once fixed, the shared scroll-pane activation gives the list and editor independent scrolling without page-specific
wheel handlers.

Deletion is destructive and requires a confirmation Dialog. Saving uses immediate pending feedback followed by Toast
success or error feedback.

The production mobile composition keeps the scrollable village list as the base screen and opens the selected editor as a
near-full-height bottom sheet. The editor owns its form scroll, while its shared ActionBar remains visible and includes both
the destructive and save actions. Closing the sheet returns to the same village list without changing the Settings route.

## Group settings — `/settings/groups`

Purpose: order tag-based Dashboard groups without changing the tags assigned to villages.

Critical information: current order and groups observed from village tags. Movement controls must be understandable without
drag-and-drop and accessible from a keyboard.

## UI Lab — separate development app

Routes: `/`, `/components`, `/patterns`, `/flows/{import,settings,dashboard,history}`, and
`/compositions/{import,dashboard,settings,history}` within `apps/ui-lab`.

Purpose: compare tokens and owned component states without Dashboard data, verify persistent App Router layout behavior,
and review fixture-only product flows across scenario, viewport, latency, and result combinations. UI Lab never owns a
production component implementation or calls product APIs.

Flow routes vary data and request state for a chosen composition. Composition routes hold fixture meaning stable while
comparing screen role, information priority, component placement, and route/Dialog/sheet choices. Preferred composition
labels are review notes, not regression contracts.

Representative fixtures are insufficient for the product's target users. Composition review must also use dozens of
villages or records and verify list scroll ownership, sticky control boundaries, result counts, no-selection states, and
whether important summaries or charts accidentally move below an effectively unbounded list.
