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

Manage the setting and resource state under `Settings → Manage villages`. Existing and new villages migrate to `unanswered` with 60 minutes enabled, preserving behavior similar to the old 60-minute reminder until the user responds. The old one-minute reminder applies only to `sufficient`.

## Game-export update flow

When an export contains active upgrades:

1. Paste JSON or use Quick Paste and review the preview.
2. Import first saves the export with state `unanswered` and schedules only notifications whose intended time has not passed.
3. After saving, prompt for `abundant`, `sufficient`, or `insufficient`.
4. A response is saved separately and future notifications are recalculated.
5. Dismissal retains the already imported export and `unanswered` state.

Do not show the prompt when no upgrade is active. Automated Push/Pull cannot show it and therefore keeps the last stored state. The prompt is never a confirmation that can cancel an import.

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

Changes under Manage villages recalculate only unsent notifications for that village.

- Never delete or reverse successful delivery records.
- Disabling preparation cancels unsent preparation rows.
- `sufficient` retains only the one-minute notification.
- `abundant` retains only completion.
- `insufficient` and `unanswered` retain completion and optionally preparation.
- If preparation time has passed, omit the unsent preparation notification.

## Data model

Accounts store:

```text
resource_status: abundant | sufficient | insufficient | unanswered
resource_status_updated_at: timestamptz
resource_preparation_minutes: integer | null
```

Notification rows store `completion`, `one_minute`, or `resource_preparation`. Although a preparation row originates from an upgrade, its suppression key is village ID plus kind. Preserve the preparation duration used at delivery so later setting changes do not alter an active suppression window.

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

## Stale village data reminder

<!-- contract: ALERT-REFRESH-001 -->

This reminder is separate from resource policy. When a tracked upgrade completes and no export or snapshot newer than its completion time arrives within 24 hours, enqueue a `refresh_required` Bark notification asking the user to paste current village data. If several upgrades for one village become due in the same Notifier claim, send only one refresh reminder. Any newer village observation makes the reminder ineligible.

## Acceptance criteria

- Import active upgrades immediately as `unanswered`, then show the resource prompt.
- Distinguish unanswered in DB while scheduling it like insufficient.
- Match all four states to the schedule above.
- Disabling preparation removes only preparation alerts.
- An overdue preparation notification is not newly scheduled when JSON or settings are applied.
- Suppress same-village preparation alerts within the preparation window.
- Recalculate only unsent rows after state or preparation changes.
