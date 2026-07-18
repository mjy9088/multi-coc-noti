import {
  planRefreshNotification,
  planResourceNotifications,
  resolvePreparationMinutes,
} from "@multi-coc/notification-policy";
import type { Account, ResourceStatus } from "@multi-coc/shared";
import type pg from "pg";

export const accountFromRow = (row: pg.QueryResultRow): Account => ({
  id: String(row.id),
  legacyIndex: row.legacy_index,
  label: row.label,
  playerTag: row.player_tag,
  color: row.color,
  tags: ((row.tags as string[]) || []).map(String),
  resourceStatus: row.resource_status as ResourceStatus,
  resourceStatusUpdatedAt: new Date(row.resource_status_updated_at).toISOString(),
  resourcePreparationMinutes:
    row.resource_preparation_minutes == null ? null : Number(row.resource_preparation_minutes),
});

export function normalizeOffsets(offsets: number[] | undefined): number[] {
  return [
    ...new Set(
      (offsets || [60, 1, 0]).map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 525_600),
    ),
  ].sort((a, b) => b - a);
}

export async function rescheduleAccountNotifications(
  client: pg.PoolClient,
  accountId: string,
  now = new Date(),
): Promise<void> {
  const account = (
    await client.query("SELECT resource_status,resource_preparation_minutes FROM accounts WHERE id=$1", [accountId])
  ).rows[0];
  if (!account) return;
  await client.query(
    `DELETE FROM upgrade_notifications n USING tracked_upgrades u
    WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.status<>'sent'
      AND (u.status<>'completed' OR n.notification_kind<>'completion')`,
    [accountId],
  );
  const upgrades = await client.query(
    "SELECT id,finish_at,resource_preparation_override_minutes FROM tracked_upgrades WHERE account_id=$1 AND status='active'",
    [accountId],
  );
  for (const upgrade of upgrades.rows) {
    const overrideMinutes =
      upgrade.resource_preparation_override_minutes == null
        ? null
        : Number(upgrade.resource_preparation_override_minutes);
    for (const notification of planResourceNotifications(
      account.resource_status as ResourceStatus,
      resolvePreparationMinutes(
        account.resource_preparation_minutes == null ? null : Number(account.resource_preparation_minutes),
        overrideMinutes,
      ),
      upgrade.finish_at,
      now,
    )) {
      await client.query(
        `INSERT INTO upgrade_notifications (upgrade_id,minutes_before,notification_kind,preparation_minutes,scheduled_at,next_attempt_at)
        VALUES ($1,$2,$3,$4,$5,$5)
        ON CONFLICT (upgrade_id,notification_kind) WHERE notification_kind<>'legacy' DO NOTHING`,
        [
          upgrade.id,
          notification.minutesBefore,
          notification.kind,
          notification.preparationMinutes,
          notification.scheduledAt,
        ],
      );
    }
    const refreshAt = planRefreshNotification(upgrade.finish_at);
    await client.query(
      `INSERT INTO upgrade_notifications (upgrade_id,minutes_before,notification_kind,preparation_minutes,scheduled_at,next_attempt_at)
      VALUES ($1,0,'refresh_required',NULL,$2,$2)
      ON CONFLICT (upgrade_id,notification_kind) WHERE notification_kind<>'legacy' DO NOTHING`,
      [upgrade.id, refreshAt],
    );
  }
}
