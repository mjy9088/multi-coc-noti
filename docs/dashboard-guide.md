# Dashboard and Settings Guide

## Navigation

The top-level menu contains `Dashboard`, `History`, `Settings`, and `Quick Paste`. History uses URL-backed
`/history/upgrades` and `/history/syncs` sections. Upgrade history shows export-detected upgrades across villages with
village, base, active/inactive, and type filters and cursor-based `Load more`. It does not label inactive records completed
or cancelled because exports cannot distinguish those outcomes reliably. Sync history shows which village export was
stored, its export and import times, and a summary of the Town Hall, active upgrades, and builder state contained in that
export. The application cannot attribute a sync to a person because admin access currently uses one shared token without
user identities. A village detail action opens Upgrade History already scoped to that village. Dashboard, History, and
Settings section tabs remain sticky below the header and scroll horizontally on mobile.

Every route provides an immediate loading state and a render-error boundary. Dashboard, History, and authenticated Settings requests also handle expected network failures explicitly: an initial failure replaces empty content with a retry action, while a refresh failure keeps already loaded data visible and marks it as stale. Settings waits for saved-token hydration before deciding whether to show the sign-in form.

The root layout owns one TanStack Query client and a persistent App Shell. Dashboard and History reads use the shared cache,
so revisiting a route can render recent data while refreshing instead of rebuilding an empty client-side state. The App
Shell keeps the top-level navigation, install action, synchronization status, locale switcher, and Quick Paste handoff
mounted while route content and its loading or error boundary change. The Quick Paste handoff is consumed once after the
Paste screen applies it, so later Settings navigation cannot replay an old clipboard request. Settings mutations invalidate Dashboard and
upgrade-history queries after a successful write.

Keyboard and programmatically focused buttons use a distinct high-contrast focus color and outline throughout the application. In the Update Data flow, the current Paste or Review card is emphasized; after review begins, the completed Paste card is dimmed as a whole and focus moves to the next required input or enabled Import action. Returning to Paste restores its active treatment.

Settings mutations provide immediate pending feedback on their action and show a fixed, high-contrast success or error toast above page content when the server responds. Success feedback dismisses itself after a short interval; error feedback remains available until dismissed or replaced, and both states are announced to assistive technology.

## UI migration boundary

The current visual design is intentionally isolated rather than treated as a long-term component system:

- `app/styles/foundations.css` contains durable semantic tokens and global browser foundations.
- `app/styles/primitives.css` contains small reusable interaction components such as mutation feedback.
- `app/styles/legacy.css` contains the current screen-specific presentation and can be replaced incrementally during a redesign.
- Settings request and mutation behavior lives in hooks, while feedback rendering lives in a standalone component. A future redesign should reuse these behavior contracts instead of carrying forward legacy selectors.

Add new cross-screen interaction behavior to a primitive or hook. Avoid extending `legacy.css` unless the rule only supports an existing screen during the migration period.

## PWA installation

The dashboard publishes a web app manifest, install icons, and a minimal service worker so supported browsers can install it with standalone display. Chromium shows `Install app` when its install prompt is available. On iOS, the button explains how to use Safari's `Share → Add to Home Screen`; iOS does not expose the Chromium install event.

The service worker deliberately does not cache dashboard API or admin traffic. Fresh village and notification state remains network-dependent, and Bark stays the only notification delivery channel. Installation requires HTTPS outside localhost.

### Dashboard

<!-- contract: DATA-UPGRADE-001 -->
<!-- contract: DATA-REFRESH-001 -->
<!-- contract: DISPLAY-SUMMARY-001 -->
<!-- contract: DISPLAY-FILTER-001 -->
<!-- contract: DISPLAY-CHART-001 -->

The title and subtitle are followed by the account filters, summary strip, and then the `Villages` and `Upgrade queue` section tabs. The tabs scroll to their sections and follow the active section during manual scrolling.

- Summary: account count, one combined idle-slot total for Home Village builders/laboratory/Pet House, a separate combined total for Builder Base builders/laboratory, and time until the next completion
- Villages: search, slot-availability filtering, update-required filtering, tag groups, and display options
- Village cards: available Home Village and Builder Base upgrade slots
- Upgrade queue: active items ordered by completion time within each account
- Upgrade outlook: completion counts grouped across the remaining time range, plus active-upgrade and available-slot area charts. Each chart shows Home Village separately and Home Village plus Builder Base as a combined total.

Search, filters, and tag groups apply to the village cards, all summary counts and next-completion time, and the upgrade queue. Slot availability is a single-choice group: all slots, an idle Home Village builder/laboratory/Pet House, or any idle Home Village/Builder Base slot. `Update required` is an independent checkbox and can be combined with the slot choice.

A village becomes update-required 30 minutes after a previously tracked upgrade completes when no newer game export has been received. Its card shows an `Update required` badge. Official Player API synchronization is profile enrichment only and is not shown as a dashboard status or filter.

Selecting a village card opens its detail view with current upgrade slots, base/type upgrade summaries, active upgrades, export-supported cooldowns, helper levels, and Hero Equipment levels. When official profile enrichment is configured, the view also shows trophies, league, war stars, donations, and Clan Capital contribution. Sections without data are hidden. It links to `/settings/villages/<uuid>` with that village selected. Keyboard users can use Enter or Space.

Village navigation uses stable UUID resource paths:

- `/villages/<uuid>`: village detail, including direct navigation and reload
- `/settings`: redirects to `/settings/paste`
- `/settings/paste`: Update Data
- `/settings/upgrades`: Upgrades & alerts
- `/settings/villages`: Manage villages without a selected village
- `/settings/villages/<uuid>`: settings with that village selected
- `/settings/groups`: Group order

Settings tab selection is represented by the URL, so tab changes, direct navigation, reload, and browser history preserve the selected section. Selecting a village updates the URL to its UUID resource path. The village route currently loads the existing `/api/dashboard` aggregate response and selects the matching village in the browser. A future data-shape review may introduce a village-specific endpoint, but route identity must remain the account UUID and missing UUIDs must not silently display another village.

On mobile, focusing search, import, authentication, and settings fields must not trigger browser auto-zoom. Text inputs use a mobile-safe font size while pinch zoom remains available.

## Account tags and groups

<!-- contract: DATA-TAGS-001 -->

Enter comma-separated account tags under `/settings/villages/<uuid>`. A leading `#` is removed and case-insensitive duplicates are merged.

- Tag groups appear after `All accounts`.
- A village can belong to multiple groups; untagged villages remain in `All accounts`.
- Search covers display names, player tags, and account tags.
- Configure order under `/settings/groups`. PostgreSQL persists the order across browsers; new groups follow configured groups alphabetically.

## Display options

<!-- contract: DISPLAY-SLOT-001 -->
<!-- contract: DISPLAY-SLOT-002 -->
<!-- contract: DISPLAY-SLOT-003 -->
<!-- contract: DISPLAY-SLOT-004 -->

Display options are stored in the current browser.

- `Infer idle Goblin Researcher`: once two concurrent research jobs prove the event active, show an eligible second slot on other villages.
- `Infer idle Goblin Builder`: once work beyond the regular builder count proves the event active, show the extra builder only when all eligible regular builders are busy.
- `Show upgrade-ready accounts first`: prioritize cards with any idle builder, laboratory, pet, Builder Base builder, or Builder Base laboratory slot.

## Updating data

In the game, use `Settings → More Settings → Data Export → Copy`, then paste through Quick Paste, the clipboard button, or the input area.

### Quick Paste

Quick Paste reads the clipboard from any screen, navigates to `/settings/paste`, and starts review. Clipboard access requires HTTPS or localhost and browser permission; manual paste remains available.

### Update Data

1. Paste or use `Paste from clipboard`.
2. Complete JSON triggers review after a 350 ms debounce. `Review` remains available for retrying errors.
3. For a known player tag, the Import button moves into view and receives focus.
4. For a new tag, enter a display name and confirm `Add village and import`.

Preview shows export time, builder and slot status, exact completion timestamps, and remaining durations. The final action area remains fixed at the bottom on mobile.

## Settings sections

| Section | Route | Purpose |
| --- | --- | --- |
| `Update Data` | `/settings/paste` | Review and import game-export JSON |
| `Upgrades & alerts` | `/settings/upgrades` | Inspect active upgrades, override preparation alerts, or open the corresponding village settings |
| `Manage villages` | `/settings/villages` or `/settings/villages/<uuid>` | Edit name, color, tags, resource policy, or delete |
| `Group order` | `/settings/groups` | Configure dashboard tag-group order |

On mobile, the Manage villages form appears before the long village list. Selecting another village scrolls back to the form.

## Resource-aware notifications

An import containing active upgrades is saved immediately with resource status `unanswered`, then asks whether the village has enough resources for the next upgrade. Closing the prompt does not cancel the import. Resource status is stored once per village and can be changed later.

- Abundant: notify at completion.
- Sufficient: notify one minute before completion.
- Insufficient or unanswered: notify at the configured preparation time and again at completion.

Preparation time is a per-village minute value and can be disabled. Each active upgrade can inherit that value, disable only its own preparation alert, or use a custom time under `Upgrades & alerts`. Preparation times that have already passed are not newly scheduled. The same village does not receive duplicate preparation alerts within its preparation window. Sent alerts survive policy changes; failed Bark requests record an error and retry time. See the [notification policy](resource-notification-policy.md).

## Storage locations

<!-- contract: API-PROFILE-002 -->

| Data | Location |
| --- | --- |
| Accounts, tags, group order, resource policy, and notification queue | PostgreSQL |
| Goblin inference and upgrade-ready sorting options | Browser localStorage |
| Language | Cookie |
| Admin token | Browser localStorage, checked against server `ADMIN_TOKEN` |
