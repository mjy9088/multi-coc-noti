# Resource-Aware Upgrade Notification Policy

## Purpose

Instead of fixed notifications 60 minutes before, one minute before, and at completion for every upgrade, notify only when action is useful according to a rough village-wide resource state. This is not an exact resource count or a per-upgrade value.

## Resource state

| State | Meaning | Schedule |
| --- | --- | --- |
| `abundant` | Plenty of resources | Completion only |
| `sufficient` | Enough resources | One minute before only |
| `insufficient` | Not enough resources | Preparation plus completion |
| `unanswered` | Prompt not answered | Stored separately, scheduled like insufficient |

Store one state for the entire village, even when several upgrades are active.

## Estimated preparation time

Each village has `resourcePreparationMinutes`.

- A positive integer enables preparation alerts.
- `null` disables preparation alerts.
- It applies only to `insufficient` and `unanswered`.
- Disabling preparation alerts does not remove completion alerts.

Manage the setting and resource state under `/settings/villages/<uuid>`. Existing and new villages migrate to `unanswered` with 60 minutes enabled, preserving behavior similar to the old 60-minute reminder until the user responds. The old one-minute reminder applies only to `sufficient`.

## Game-export update flow

When an export contains active upgrades:

1. Paste JSON or use Quick Paste and review the preview.
2. Import first saves the export with state `unanswered` and schedules only notifications whose intended time has not passed.
3. After saving, prompt for `abundant`, `sufficient`, or `insufficient`.
4. A response is saved separately and future notifications are recalculated.
5. Dismissal retains the already imported export and `unanswered` state.

Do not show the prompt when no upgrade is active. The prompt is never a confirmation that can cancel an import.

## Notification schedule

<!-- contract: ALERT-PLAN-001 -->

### Abundant

Notify at completion only.

### Sufficient

Notify one minute before completion only; do not also send a completion alert.

### Insufficient or unanswered

When preparation is enabled, schedule `resource_preparation` at completion minus the configured preparation time and schedule `completion` at completion. When preparation is disabled, schedule completion only.

## Passed preparation alert

If the preparation time has already passed when an export or setting is applied, do not create a late preparation notification. This prevents pasting village JSON from immediately triggering Bark. Completion notifications remain scheduled according to the resource state.

Example: with 40 minutes remaining, a 60-minute estimate, and state `insufficient`, omit the preparation notification and retain the completion notification.

## Preparation-alert deduplication

Suppress `resource_preparation` by village and notification kind, not by upgrade.

- Suppression starts at the last successful preparation delivery and lasts for the preparation duration stored with that delivery.
- Multiple due upgrades for one village produce only one preparation alert during the window.
- Other villages are independent.
- Completion alerts are never suppressed and remain per upgrade for insufficient/unanswered villages.
- DB claiming is atomic, so concurrent workers still deliver at most one.
- Failed Bark calls do not count as successful suppression and follow normal retry behavior.

Example: a successful 45-minute preparation alert for village A at 10:00 suppresses A at 10:20 but permits A at 10:46. Village B remains eligible throughout.

## Editing state and settings

Changes under `/settings/villages/<uuid>` recalculate only unsent notifications for that village.

- Never delete or reverse successful delivery records.
- Disabling preparation cancels unsent preparation rows.
- `sufficient` retains only the one-minute notification.
- `abundant` retains only completion.
- `insufficient` and `unanswered` retain completion and optionally preparation.
- If preparation time has passed, omit the unsent preparation notification.

## Per-upgrade preparation overrides

<!-- contract: ALERT-OVERRIDE-001 -->

Under `/settings/upgrades`, each active upgrade can inherit its village's preparation time, disable only its own preparation alert, or use a custom number of minutes. The override affects only `resource_preparation`; completion, one-minute, and stale-data notifications continue to follow the village resource policy.

Saving an override recalculates unsent notifications for that village without changing successful delivery records. A tracked upgrade keeps its override when a newer observation updates the same source key. Each row also links directly to the corresponding village settings.

## Data model

Accounts store:

```text
resource_status: abundant | sufficient | insufficient | unanswered
resource_status_updated_at: timestamptz
resource_preparation_minutes: integer | null
```

Notification rows store `completion`, `one_minute`, or `resource_preparation`. Although a preparation row originates from an upgrade, its suppression key is village ID plus kind. Preserve the preparation duration used at delivery so later setting changes do not alter an active suppression window.

Tracked upgrades store `resource_preparation_override_minutes`: `null` inherits the village value, `0` disables preparation for that upgrade, and a positive integer supplies a custom duration.

## Migration from fixed offsets

This policy replaces per-upgrade `notificationOffsets` and the direct `60, 1, 0` UI.

- Recreate unsent rows for active upgrades from village resource state.
- Preserve sent rows for audit and deduplication.
- Cancel processing or retry rows that no longer exist in the new policy.
- Include resource state and preparation time in history backups.

## Bark copy

<!-- contract: ALERT-COPY-001 -->

Example message meanings (the Korean locale uses equivalent localized copy):

- Preparation: `{village}: Prepare resources now. About {duration} until {upgrade} completes.`
- One minute: `{village}: One minute until {upgrade} completes.`
- Completion: `{village}: {upgrade} level {next level} completed.`

The English locale conveys the same meaning.

## Delivery channels and presentation

Scheduling policy remains independent from delivery-channel presentation. `upgrade_notifications` records what should be
delivered and when; it does not store Bark sounds, interruption levels, device keys, or navigation URLs.

<!-- contract: ALERT-BARK-001 -->

A Bark channel has channel-wide connection defaults, while each notification kind can have a delivery rule. A resolved
rule can enable or disable delivery and select `sound`, interruption `level`, critical-alert `volume`, repeated sound,
archive behavior and TTL, notification grouping, and the URL opened on tap. Payload generation must omit parameters that
do not apply: volume is sent only for `critical`, archive TTL only when archiving is enabled, and repeated sound only when
explicitly requested.

The initial environment-backed channel preserves current behavior: completion uses `minuet`, other kinds use `bell`, all
kinds use `active`, and `BARK_GROUP` and `BARK_ICON` remain channel defaults. Database channel rows and rules are groundwork
for later user ownership and management APIs; merely adding them must not create an additional recipient or duplicate an
environment-backed delivery.

One scheduled notification can eventually fan out into one `notification_deliveries` row per enabled channel. Delivery
status, lease, retry count, and error belong to that channel-specific row so one device's failure cannot resend another
device's successful delivery. Preparation suppression is likewise keyed by village and channel: all enabled recipients can
receive the useful reminder once, while repeated reminders to the same recipient remain suppressed.

Notifier uses managed database channels whenever at least one enabled, fully configured Bark channel exists. Missing rules
inherit the Bark defaults above; disabled rules omit that notification kind for the channel. If no managed channel is
available, Notifier uses the environment-backed channel and legacy queue state as a compatibility fallback. It never sends
one scheduled event through both modes in the same run.

## Stale village data reminder

<!-- contract: ALERT-REFRESH-001 -->

This reminder is separate from resource policy. When a tracked upgrade completes and no game export newer than its completion time arrives within 24 hours, enqueue a `refresh_required` Bark notification asking the user to paste current village data. If several upgrades for one village become due in the same Notifier claim, send only one refresh reminder. Any newer export makes the reminder ineligible.

## Acceptance criteria

- Import active upgrades immediately as `unanswered`, then show the resource prompt.
- Distinguish unanswered in DB while scheduling it like insufficient.
- Match all four states to the schedule above.
- Disabling preparation removes only preparation alerts.
- An overdue preparation notification is not newly scheduled when JSON or settings are applied.
- Suppress same-village preparation alerts within the preparation window.
- Recalculate only unsent rows after state or preparation changes.
- Apply per-upgrade preparation overrides without removing other notification kinds.
