# Village Data Update Flow

## Goal

Routine work should be pasting and reviewing game-export JSON, not editing account records. The first Settings section therefore follows `paste → automatic review → import`. Game player tags and user-defined account-group tags are different concepts.

## Standard flow

<!-- contract: DATA-SNAPSHOT-001 -->

1. Paste through Quick Paste, the Update Data clipboard button, or the text area.
2. Once a complete JSON document is detected, debounce briefly and request a server preview. Discard stale preview responses after input changes.
3. Validate JSON, player tag, export timestamp, and timer ranges.
4. Identify an existing village by player tag without asking the user to select it.
5. Preview village identity, Town Hall, export time, builders, upgrades, and remaining durations.
6. For an existing village, focus Import and apply the data after confirmation.

Imports with active upgrades first save `unanswered`, then ask for the village-wide resource state. The response is saved separately; dismissing the prompt retains the imported data and unanswered state. See the [notification policy](resource-notification-policy.md).

For a new player tag, clearly label the preview as new and require a display name plus explicit creation confirmation. Pasting invalid or unintended JSON must never create an account automatically.

## Server validation

<!-- contract: IMPORT-TAG-001 -->
<!-- contract: IMPORT-VALIDATION-001 -->

- Player tags must satisfy Supercell's character rules and exactly match an existing village.
- Export time may be at most 10 minutes in the future and at most 30 days old.
- Only exports newer than the latest stored export are applied.
- Active timers must be numeric and no longer than 180 days.
- Levels and data IDs outside accepted ranges are rejected.

The server computes completion as `timestamp + timer` and uses `clash-of-clans-data` mappings to normalize buildings, heroes, pets, research, and Builder Base items.

<!-- contract: IMPORT-COOLDOWN-001 -->

Clock Tower and village-helper cooldown seconds are converted to absolute availability times using the export timestamp. The current game export does not provide Star Bonus or Capital Gold Forge cooldowns, so they must not be estimated.

<!-- contract: IMPORT-DETAIL-001 -->
<!-- contract: IMPORT-KEY-001 -->

Village details preserve helper and Hero Equipment identities and levels from game exports. Official profile enrichment adds trophies, league, war stars, donations, and Clan Capital contribution when the server API token is configured. The UI hides sections for data that is not present.

Export upgrade identities use section, data ID, next level, and an ordinal among identical items. Reordering unrelated entries must not create a new tracked upgrade or detach its notification settings.

The unified upgrade tracker preserves each upgrade's `home` or `builder` base classification. Existing tracker rows are backfilled from the newest stored export during migration so dashboard totals remain separated after an upgrade.

## Export history backup

Village history backups use JSON Lines v2. The first record contains village identity, display metadata, resource policy, and per-upgrade alert overrides; each following record contains one raw game export in chronological order. Restore reparses every raw export and rebuilds the tracked-upgrade projection, so normalized parser output is not treated as durable backup data.

The importer also accepts legacy v1 JSON bundles, ignores their obsolete snapshot records, and restores their game exports. A duplicate timestamp with identical raw data is idempotent; conflicting raw data at the same village and timestamp is rejected.

## Upgrade availability

<!-- contract: IMPORT-PARSE-001 -->
<!-- contract: IMPORT-SLOT-001 -->
<!-- contract: IMPORT-SLOT-002 -->
<!-- contract: IMPORT-SLOT-003 -->
<!-- contract: IMPORT-SLOT-004 -->

- Home Village builders: derive total builders from Builder Huts and B.O.B Control unlock state, then subtract active building and hero upgrades.
- Home Village laboratory: available only when unlocked and neither the facility nor unit, spell, or siege research is active. Two concurrent research timers prove a Goblin Researcher slot.
- Pets: available only when Pet House exists and neither the facility nor a pet upgrade is active.
- Builder Base builders: subtract Builder Base building, trap, and hero work separately. An unlocked O.T.T.O's Outpost implies at least two builders; three concurrent jobs preserve the additional-builder observation.
- Builder Base laboratory: available only when Star Laboratory exists and neither the facility nor Builder Base unit research is active.

Pet and research work does not consume Home Village builders. Hide locked facilities. Older stored exports without `upgradeSlots` remain readable; new state appears after the next export.

## Screen priorities

Settings routes are `/settings/paste`, `/settings/upgrades`, `/settings/villages`, `/settings/villages/<uuid>`, and `/settings/groups`. New villages are created only through JSON paste. Mobile layouts keep section tabs and the import action sticky, place the Manage villages form before the list, and return to the form after village selection.

## Identifier rules

- Player tag: stable game identifier used to match exports and registered villages.
- Account tag: user metadata for grouping villages; unrelated to player tags.
- UUID: internal identifier for DB relations and management API paths.
- Do not expose or rely on user-visible numeric indexes.
- Sort lists by meaningful fields such as label or recent update time.

## Errors and safeguards

- A player-tag mismatch cannot be bypassed by selecting another account.
- New tags require a label and explicit creation confirmation.
- Reject stale exports, suspicious future timestamps, and invalid timers.
- On success, show the target village and applied upgrade count, then clear input.
- Keep label changes, integrations, and deletion separate from JSON import.
- When Clipboard API is unavailable, manual text-area paste must still work.
