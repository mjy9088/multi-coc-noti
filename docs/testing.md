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
| `API-PROFILE-003` | Preserve the configured Display Name during official profile enrichment instead of replacing it with the in-game name. | [Dashboard](dashboard-guide.md#dashboard) | Collector unit |
| `AUTH-ISOLATION-001` | Allow the same player tag for different users while isolating village reads, mutations, history, settings, and notification channels. | [Authentication: Village ownership](authentication.md#village-ownership) | Database and Collector integration |
| `AUTH-TEST-001` | Keep local ID/password login absent unless explicitly enabled with complete credentials, and create a normal database session when used. | [Authentication: Optional local test login](authentication.md#optional-local-test-login) | Dashboard unit and PostgreSQL integration |
| `OPS-PROXY-001` | Route Auth.js endpoints to Dashboard, application APIs and health to Collector, and other paths to Dashboard behind one public port. | [Operations: Reverse proxy chains and PWA deployment](operations.md#reverse-proxy-chains-and-pwa-deployment) | Reverse-proxy unit |
| `OPS-PROXY-002` | Survive normal HTTP cancellation and WebSocket/HMR disconnect errors without terminating the gateway. | [Operations: Reverse proxy chains and PWA deployment](operations.md#reverse-proxy-chains-and-pwa-deployment) | Reverse-proxy integration |
| `DATA-UPGRADE-001` | Treat upgrades as active only before a valid finish time, preventing completed work from remaining queued. | [Dashboard](dashboard-guide.md#dashboard) | Shared unit |
| `DATA-REFRESH-001` | Mark a village update-required exactly 30 minutes after an upgrade completion that has no newer observation. | [Dashboard](dashboard-guide.md#dashboard) | Shared unit |
| `DATA-TAGS-001` | Normalize comma-separated tags and remove case-insensitive duplicates and `#`, preventing duplicate groups. | [Dashboard: Account tags and groups](dashboard-guide.md#account-tags-and-groups) | Shared unit |
| `IMPORT-TAG-001` | Normalize player tags and reject forbidden characters, preventing data from attaching to the wrong account. | [Data flow: Server validation](village-data-flow.md#server-validation) | Village export unit |
| `IMPORT-PARSE-001` | Extract and classify both villages' active work and absolute completion times from game exports. | [Data flow: Upgrade availability](village-data-flow.md#upgrade-availability) | Village export unit |
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
| `ALERT-BARK-001` | Resolve Bark presentation by notification kind and omit inapplicable advanced parameters, keeping delivery concerns outside scheduling. | [Notification policy: Delivery channels and presentation](resource-notification-policy.md#delivery-channels-and-presentation) | Notifier unit |
| `DISPLAY-SLOT-001` | Use a helper event observed on any account in global display calculations, avoiding inconsistent event state. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SLOT-002` | Offer an eligible second research slot after any account proves the event active. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SLOT-003` | Offer Goblin Builder only when all eligible regular builders are busy. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SLOT-004` | Preserve original slots when inference is disabled, respecting browser preferences. | [Dashboard: Display options](dashboard-guide.md#display-options) | Display-calculation unit |
| `DISPLAY-SUMMARY-001` | Total idle Home Village builder/laboratory/Pet House slots while keeping Builder Base builder/laboratory slots in a separate total. | [Dashboard](dashboard-guide.md#dashboard) | Display-calculation unit |
| `DISPLAY-FILTER-001` | Distinguish Home Village availability from availability in either village so the single-choice slot filter has stable semantics. | [Dashboard](dashboard-guide.md#dashboard) | Display-calculation unit |
| `DISPLAY-CHART-001` | Project completion bins, active work, and released slots for Home Village and the combined bases on one timeline. | [Dashboard](dashboard-guide.md#dashboard) | Display-calculation unit |
| `UI-SETTINGS-001` | Preserve the mounted Settings shell across URL-backed tabs, hand pointer scrolling from the outer page to the fixed route frame, and give desktop/mobile village panes one intentional scroll owner. | [UI screens: Persistent App Shell](ui/screens.md#persistent-app-shell) | Dashboard browser E2E |
| `UI-ROUTES-001` | Compose Dashboard, village detail, and History from owned primitives without page-level horizontal overflow. | [UI screens: Dashboard](ui/screens.md#dashboard-) | Dashboard browser E2E |
| `DB-MIGRATION-001` | Create fresh databases from generated migrations and baseline existing schemas without losing data. | [Operations: Data storage](operations.md#data-storage) | PostgreSQL integration |
| `DB-HISTORY-001` | Scope history export and restore to explicit owners, restore header settings without cross-user tag merging, rebuild projections atomically, and expose restored data through a running Collector. | [Operations: Backup and restore](operations.md#backup-and-restore) | PostgreSQL integration and Collector unit |
| `DB-NOTIFICATION-001` | Claim legacy and managed-channel deliveries exclusively, isolate channel state, and release the matching resource suppression on failure. | [Operations: Separate Notifier deployment](operations.md#separate-notifier-deployment) | PostgreSQL integration |
| `TEST-DOC-001` | Compare feature declarations, this registry, and test IDs in both directions; reject duplicate declarations. | This [Purpose](#purpose) | Documentation consistency |

`IMPORT-SLOT-*` protects facts extracted from one export. `DISPLAY-SLOT-*` protects applying observations across accounts and browser display options. They operate at different layers and are intentionally both retained.

## Major contracts not yet automated

These documented behaviors are not directly protected by `pnpm test`. Treat them as manual review requirements until adding tests and registry IDs.

1. The full import flow from initial unanswered storage to a separately saved resource response
2. Authenticated preview/import, new-village creation, and newest-export precedence
3. Mobile fast import from clipboard through Review and save, preservation of input after failure, appropriate route/Dialog presentation, visible guided focus, completed-step dimming, focus movement without browser auto-zoom, sticky tabs, responsive ordering, Settings village search and list/editor-sheet scroll ownership, persistent App Shell geometry, and the 30-minute update-required browser filter
4. Group ordering, tag groups, and upgrade-ready sorting in the browser
5. Maintenance CLI JSONL compatibility plus seed/reseed behavior
6. The 24-hour stale-village notification's DB eligibility, cancellation after fresh data, and per-village deduplication
7. DB migration backfill of Home Village and Builder Base classification on existing tracked upgrades
8. PWA installation prompts and manifest/service-worker behavior through chained HTTPS reverse proxies
9. Village card → `/villages/<uuid>` → `/settings/villages/<uuid>` navigation, URL-backed settings tabs, direct reload and missing-village handling, hidden empty detail sections, official-stat rendering, and cooldown transition to available
10. REST upgrade-history filtering and pagination, the global History screen, `Load more`, and village-detail prefiltered navigation
11. Persistent Settings/History route layouts, non-replacing route loading boundaries, initial-failure, stale-data, retry states, and visible mutation feedback across Dashboard, History, and Settings
12. URL-backed Upgrade/Sync History sections, sync-history village filtering and pagination, and export/import timestamp plus state-summary rendering

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

`pnpm lint:ui-contracts` parses owned CSS with PostCSS and rejects layout patterns for which the design system already has
a safer solution. It currently enforces bottom-sheet edge attachment, sticky-surface ownership, `ActionBar` use for
bottom-sticky actions, paired sticky bleed variables, `SplitLayout` use for top-aligned multi-pane layouts, mobile-safe form
font sizes, semantic layer tokens, color/radius/shadow tokens, owned `Dialog` use for feature overlays, explicit surface
context, and shrinkable scroll containers. Local ESLint rules additionally reject non-interactive click targets, unlabeled
symbol-only buttons, and feature-local feedback toast imports. Diagnostics name the replacement component or property
rather than only describing the violation. Generated output and the explicitly excluded legacy stylesheet are not scanned.

If an exceptional composition genuinely cannot use the shared solution, place
`/* ui-contract-disable-next-line <rule-id> -- <specific reason> */` immediately before the affected CSS rule. A reason is
mandatory; prefer improving the shared primitive before suppressing a rule.

Installing dependencies also installs the repository's Lefthook-managed Git hook. Before each commit, it applies Biome safe
fixes to staged supported files, stages those fixes, and runs Next.js ESLint when staged Dashboard JavaScript or TypeScript
files are present. It also runs UI contract lint against staged owned CSS. Full type checks, tests, and builds remain in
`pnpm test` and `just check` rather than slowing every commit.

`TEST-DOC-001` verifies that feature-document declarations, registry IDs, and test-title IDs are identical sets, and rejects duplicate declarations. Requirements without feasible automation remain in the gap list above; add all three locations when implementing their tests.
