# Test Contracts and Documentation Links

## Purpose

<!-- contract: TEST-DOC-001 -->

A `<!-- contract: CONTRACT-ID -->` declaration beside a normative requirement and the same ID in square brackets in a regression-test title identify one contract. When a test fails:

- Fix the implementation if the contract remains valid.
- If product requirements changed, update the source document first and change implementation and tests together.
- Remove a test and registry row only when the documented reason for the contract no longer applies.

Do not change contract expectations merely because of a refactor. One ID represents one user-visible or operational contract even when its test covers several inputs.

## Contract registry

| Contract ID | Protected behavior and reason | Normative source | Automation level |
| --- | --- | --- | --- |
| `API-PROFILE-001` | Encode and authenticate official API requests and map profiles into the internal shape, preventing incorrect account enrichment. | [Operations: Collection paths](operations.md#collection-paths) | Collector unit |
| `API-PROFILE-002` | Never overwrite example data with an official profile, preventing demo content from appearing synchronized. | [Dashboard: Storage locations](dashboard-guide.md#storage-locations) | Collector unit |
| `API-PROFILE-003` | Preserve the configured Display Name during official profile enrichment instead of replacing it with the in-game name. | [Dashboard](dashboard-guide.md#dashboard) | Collector unit |
| `OPS-PROXY-001` | Route `/api` exclusively to Collector and all other PWA and Next.js paths to Dashboard behind one public port. | [Operations: Reverse proxy chains and PWA deployment](operations.md#reverse-proxy-chains-and-pwa-deployment) | Reverse-proxy unit |
| `DATA-UPGRADE-001` | Treat upgrades as active only before a valid finish time, preventing completed work from remaining queued. | [Dashboard](dashboard-guide.md#dashboard) | Shared unit |
| `DATA-REFRESH-001` | Mark a village update-required exactly 30 minutes after an upgrade completion that has no newer observation. | [Dashboard](dashboard-guide.md#dashboard) | Shared unit |
| `DATA-TAGS-001` | Normalize comma-separated tags and remove case-insensitive duplicates and `#`, preventing duplicate groups. | [Dashboard: Account tags and groups](dashboard-guide.md#account-tags-and-groups) | Shared unit |
| `IMPORT-TAG-001` | Normalize player tags and reject forbidden characters, preventing data from attaching to the wrong account. | [Data flow: Server validation](village-data-flow.md#server-validation) | Village export unit |
| `IMPORT-PARSE-001` | Extract both villages' active work, completion times, builders, and research slots from game exports. | [Data flow: Upgrade availability](village-data-flow.md#upgrade-availability) | Village export unit |
| `IMPORT-SLOT-001` | Report unlocked idle workers and facilities as available, protecting upgrade-ready status. | [Data flow: Upgrade availability](village-data-flow.md#upgrade-availability) | Village export unit |
| `IMPORT-SLOT-002` | Infer a Goblin Researcher from concurrent research timers because exports have no dedicated event key. | [Data flow: Upgrade availability](village-data-flow.md#upgrade-availability) | Village export unit |
| `IMPORT-SLOT-003` | Infer the additional Builder Base builder from three concurrent jobs, preserving the observed total. | [Data flow: Upgrade availability](village-data-flow.md#upgrade-availability) | Village export unit |
| `IMPORT-SLOT-004` | Hide locked slots and mark upgrading facilities busy, preventing impossible upgrade suggestions. | [Data flow: Upgrade availability](village-data-flow.md#upgrade-availability) | Village export unit |
| `IMPORT-VALIDATION-001` | Reject stale/future exports and suspicious timers, preventing invalid input from replacing current state. | [Data flow: Server validation](village-data-flow.md#server-validation) | Village export unit |
| `IMPORT-COOLDOWN-001` | Convert exported Clock Tower and helper cooldowns into absolute availability times without inventing unsupported cooldowns. | [Data flow: Server validation](village-data-flow.md#server-validation) | Village export unit |
| `IMPORT-DETAIL-001` | Preserve helper and Hero Equipment identities and levels for useful village detail views. | [Data flow: Server validation](village-data-flow.md#server-validation) | Village export unit |
| `IMPORT-KEY-001` | Keep export upgrade identities stable when unrelated array entries reorder, preserving history and notification settings. | [Data flow: Server validation](village-data-flow.md#server-validation) | Village export unit |
| `IMPORT-DIFF-001` | Summarize upgrade and slot changes against the newest stored export, making Review explain what changed before import. | [Data flow: Standard flow](village-data-flow.md#standard-flow) | Village export unit |
| `ALERT-COPY-001` | Produce distinguishable localized preparation, completion, and stale-village copy, preventing action ambiguity. | [Notification policy: Bark copy](resource-notification-policy.md#bark-copy) | Notifier unit |
| `ALERT-PLAN-001` | Map resource states to their documented future schedules and omit late preparation alerts. | [Notification policy: Notification schedule](resource-notification-policy.md#notification-schedule) | Planning-function unit |
| `ALERT-OVERRIDE-001` | Resolve inherited, disabled, and custom per-upgrade preparation settings without changing the village default. | [Notification policy: Per-upgrade preparation overrides](resource-notification-policy.md#per-upgrade-preparation-overrides) | Planning-function unit |
| `ALERT-REFRESH-001` | Schedule a stale-village reminder exactly 24 hours after the unobserved upgrade completion. | [Notification policy: Stale village data reminder](resource-notification-policy.md#stale-village-data-reminder) | Planning-function unit |
| `ALERT-DELIVERY-001` | Deliver already-claimed rows through Bark and record success, preventing successful redelivery. | [Operations: Separate Notifier deployment](operations.md#separate-notifier-deployment) | Notifier plus fake Bark integration |
| `ALERT-DELIVERY-002` | Return Bark failures to failed/retry handling, preventing permanent loss during transient outages. | [Operations: Separate Notifier deployment](operations.md#separate-notifier-deployment) | Notifier unit |
| `DISPLAY-SLOT-001` | Use a helper event observed on any account in global display calculations, avoiding inconsistent event state. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SLOT-002` | Offer an eligible second research slot after any account proves the event active. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SLOT-003` | Offer Goblin Builder only when all eligible regular builders are busy. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SLOT-004` | Preserve original slots when inference is disabled, respecting browser preferences. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SUMMARY-001` | Total idle Home Village builder/laboratory/Pet House slots while keeping Builder Base builder/laboratory slots in a separate total. | [Dashboard](dashboard-guide.md#dashboard) | Display-calculation unit |
| `DISPLAY-FILTER-001` | Distinguish Home Village availability from availability in either village so the single-choice slot filter has stable semantics. | [Dashboard](dashboard-guide.md#dashboard) | Display-calculation unit |
| `DISPLAY-CHART-001` | Project completion bins, active work, and released slots for Home Village and the combined bases on one timeline. | [Dashboard](dashboard-guide.md#dashboard) | Display-calculation unit |
| `TEST-DOC-001` | Compare feature declarations, this registry, and test IDs in both directions; reject duplicate declarations. | This [Purpose](#purpose) | Documentation consistency |

`IMPORT-SLOT-*` protects facts extracted from one export. `DISPLAY-SLOT-*` protects applying observations across accounts and browser display options. They operate at different layers and are intentionally both retained.

## Major contracts not yet automated

These documented behaviors are not directly protected by `pnpm test`. Treat them as manual review requirements until adding tests and registry IDs.

1. Atomic same-village preparation-alert suppression and release after delivery failure
2. The full import flow from initial unanswered storage to a separately saved resource response
3. Admin authentication, preview/import, new-account creation, and newest-export precedence
4. Mobile Quick Paste, automatic Review, visible guided focus, completed-step dimming, focus movement without browser auto-zoom, sticky tabs, responsive ordering, and the 30-minute update-required browser filter
5. Group ordering, tag groups, and upgrade-ready sorting in the browser
6. DB export-history backup/import/seed/reseed and schema migrations
7. The 24-hour stale-village notification's DB eligibility, cancellation after fresh data, and per-village deduplication
8. DB migration backfill of Home Village and Builder Base classification on existing tracked upgrades
9. PWA installation prompts and manifest/service-worker behavior through chained HTTPS reverse proxies
10. Village card → `/villages/<uuid>` → `/settings/villages/<uuid>` navigation, URL-backed settings tabs, direct reload and missing-village handling, hidden empty detail sections, official-stat rendering, and cooldown transition to available
11. REST upgrade-history filtering and pagination, the global History screen, `Load more`, and village-detail prefiltered navigation
12. Route loading/error boundaries, initial-failure, stale-data, saved-token hydration, retry states, and visible mutation feedback across Dashboard, History, and Settings
13. URL-backed Upgrade/Sync History sections, sync-history village filtering and pagination, and export/import timestamp plus state-summary rendering

Prioritize notification DB integration, import API integration, then the core mobile update browser flow. Notification duplication and loss are user-visible, and transaction behavior cannot be proven by planning-function unit tests.

## Adding, changing, or removing tests

Root [`AGENTS.md`](../AGENTS.md) summarizes this workflow so new contributors and automation agents discover it immediately.

1. Reuse an ID only when extending the same contract and its description remains accurate.
2. Add a new ID first or in the same change for an independent user or operational contract.
3. For implementation-only tests, explain the refactoring rationale near the test instead of inventing a contract ID.
4. Remove the source declaration, registry row, and tests together only when the requirement no longer applies.
5. Search this file for the ID shown in CI output.

## Formatting and linting

Run `pnpm format` to apply Biome formatting, import organization, and safe fixes across supported source files. Run
`pnpm format:check` for the non-writing CI check. Biome handles repository-wide formatting and general static analysis;
Dashboard ESLint remains enabled for Next.js and React-specific rules. The current
`apps/dashboard/app/styles/legacy.css` is intentionally excluded to avoid a noisy mechanical rewrite before the planned UI
redesign.

Installing dependencies also installs the repository's Lefthook-managed Git hook. Before each commit, it applies Biome safe
fixes to staged supported files, stages those fixes, and runs Next.js ESLint when staged Dashboard JavaScript or TypeScript
files are present. Full type checks, tests, and builds remain in `pnpm test` and `just check` rather than slowing every
commit.

`TEST-DOC-001` verifies that feature-document declarations, registry IDs, and test-title IDs are identical sets, and rejects duplicate declarations. Requirements without feasible automation remain in the gap list above; add all three locations when implementing their tests.
