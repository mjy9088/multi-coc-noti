# Dashboard and Settings Guide

## Navigation

The top-level menu contains `Dashboard`, `Settings`, and `Quick Paste`. `History` is not active yet. Dashboard and Settings section tabs remain sticky below the header and scroll horizontally on mobile.

### Dashboard

<!-- contract: DATA-UPGRADE-001 -->
<!-- contract: DATA-REFRESH-001 -->
<!-- contract: DISPLAY-SUMMARY-001 -->
<!-- contract: DISPLAY-FILTER-001 -->

The title and subtitle are followed by the account filters, summary strip, and then the `Villages` and `Upgrade queue` section tabs. The tabs scroll to their sections and follow the active section during manual scrolling.

- Summary: account count, one combined idle-slot total for Home Village builders/laboratory/Pet House, a separate combined total for Builder Base builders/laboratory, and time until the next completion
- Villages: search, slot-availability filtering, update-required filtering, tag groups, and display options
- Village cards: available Home Village and Builder Base upgrade slots
- Upgrade queue: active items ordered by completion time within each account

Search, filters, and tag groups apply to the village cards, all summary counts and next-completion time, and the upgrade queue. Slot availability is a single-choice group: all slots, an idle Home Village builder/laboratory/Pet House, or any idle Home Village/Builder Base slot. `Update required` is an independent checkbox and can be combined with the slot choice.

A village becomes update-required 30 minutes after a previously tracked upgrade completes when no newer export or snapshot has been received. Its card shows an `Update required` badge. Official Player API synchronization is profile enrichment only and is not shown as a dashboard status or filter.

Selecting a village card opens `Settings → Manage villages` with that village selected. Keyboard users can use Enter or Space.

## Account tags and groups

<!-- contract: DATA-TAGS-001 -->

Enter comma-separated account tags under `Settings → Manage villages`. A leading `#` is removed and case-insensitive duplicates are merged.

- Tag groups appear after `All accounts`.
- A village can belong to multiple groups; untagged villages remain in `All accounts`.
- Search covers display names, player tags, and account tags.
- Configure order under `Settings → Group order`. PostgreSQL persists the order across browsers; new groups follow configured groups alphabetically.

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

Quick Paste reads the clipboard from any screen, opens `Settings → Update Data`, and starts review. Clipboard access requires HTTPS or localhost and browser permission; manual paste remains available.

### Update Data

1. Paste or use `Paste from clipboard`.
2. Complete JSON triggers review after a 350 ms debounce. `Review` remains available for retrying errors.
3. For a known player tag, the Import button moves into view and receives focus.
4. For a new tag, enter a display name and confirm `Add village and import`.

Preview shows export time, builder and slot status, exact completion timestamps, and remaining durations. The final action area remains fixed at the bottom on mobile.

## Settings sections

| Section | Purpose |
| --- | --- |
| `Update Data` | Review and import game-export JSON |
| `Upgrades & alerts` | Inspect active upgrades and effective Bark policy |
| `Manage villages` | Edit name, color, tags, Pull URL, API key, resource policy, or delete |
| `Group order` | Configure dashboard tag-group order |

On mobile, the Manage villages form appears before the long village list. Selecting another village scrolls back to the form.

## Resource-aware notifications

An import containing active upgrades is saved immediately with resource status `unanswered`, then asks whether the village has enough resources for the next upgrade. Closing the prompt does not cancel the import. Resource status is stored once per village and can be changed later.

- Abundant: notify at completion.
- Sufficient: notify one minute before completion.
- Insufficient or unanswered: notify at the configured preparation time and again at completion.

Preparation time is a per-village minute value and can be disabled. Overdue preparation notifications become eligible on the next Notifier cycle. The same village does not receive duplicate preparation alerts within its preparation window. Sent alerts survive policy changes; failed Bark requests record an error and retry time. See the [notification policy](resource-notification-policy.md).

## Storage locations

<!-- contract: API-PROFILE-002 -->

| Data | Location |
| --- | --- |
| Accounts, tags, group order, resource policy, and notification queue | PostgreSQL |
| Goblin inference and upgrade-ready sorting options | Browser localStorage |
| Language | Cookie |
| Admin token | Browser localStorage, checked against server `ADMIN_TOKEN` |
