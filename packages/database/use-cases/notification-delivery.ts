import type pg from "pg";
import { database } from "../client.ts";
import type { DueNotification, NotificationKind } from "../types.ts";

export async function claimDueNotifications(limit = 20, now = new Date()): Promise<DueNotification[]> {
  await database().query(
    `
    UPDATE upgrade_notifications SET status='skipped',locked_at=NULL,last_error='reminder window missed',updated_at=now()
    WHERE notification_kind='one_minute' AND status IN ('pending','processing') AND scheduled_at < $1::timestamptz - interval '2 minutes'
  `,
    [now],
  );
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const candidates = await client.query(
      `
      SELECT n.id,n.upgrade_id,n.notification_kind,n.minutes_before,n.preparation_minutes,
        a.id AS account_id,a.label AS account_name,u.name AS upgrade_name,u.next_level,u.finish_at
      FROM upgrade_notifications n
      JOIN tracked_upgrades u ON u.id=n.upgrade_id JOIN accounts a ON a.id=u.account_id
      WHERE u.status IN ('active','completed') AND n.scheduled_at <= $1 AND n.next_attempt_at <= $1
        AND (n.status='pending' OR (n.status='processing' AND n.locked_at < $1 - interval '5 minutes'))
        AND (n.notification_kind<>'refresh_required' OR NOT EXISTS (
          SELECT 1 FROM village_exports e WHERE e.account_id=u.account_id AND e.exported_at>u.finish_at
        ))
      ORDER BY n.scheduled_at FOR UPDATE OF n SKIP LOCKED LIMIT $2
    `,
      [now, limit],
    );
    const claimed: pg.QueryResultRow[] = [];
    const refreshAccounts = new Set<string>();
    for (const row of candidates.rows) {
      if (row.notification_kind === "refresh_required" && refreshAccounts.has(String(row.account_id))) {
        await client.query(
          "UPDATE upgrade_notifications SET status='skipped',last_error='refresh reminder deduplicated',updated_at=now() WHERE id=$1",
          [row.id],
        );
        continue;
      }
      if (row.notification_kind === "resource_preparation") {
        const suppression = await client.query(
          `
          INSERT INTO resource_reminder_suppressions (account_id,notification_id,suppress_until,preparation_minutes)
          VALUES ($1,$2,$3::timestamptz + ($4 * interval '1 minute'),$4)
          ON CONFLICT (account_id) DO UPDATE SET notification_id=EXCLUDED.notification_id,
            suppress_until=EXCLUDED.suppress_until,preparation_minutes=EXCLUDED.preparation_minutes,updated_at=now()
          WHERE resource_reminder_suppressions.suppress_until <= $3 OR resource_reminder_suppressions.notification_id=$2
          RETURNING notification_id
        `,
          [row.account_id, row.id, now, row.preparation_minutes],
        );
        if (!suppression.rowCount) {
          await client.query(
            "UPDATE upgrade_notifications SET status='skipped',last_error='resource reminder suppressed',updated_at=now() WHERE id=$1",
            [row.id],
          );
          continue;
        }
      }
      await client.query(
        "UPDATE upgrade_notifications SET status='processing',locked_at=$2,attempts=attempts+1,updated_at=now() WHERE id=$1",
        [row.id, now],
      );
      if (row.notification_kind === "refresh_required") {
        refreshAccounts.add(String(row.account_id));
        await client.query(
          `
          UPDATE upgrade_notifications n SET status='skipped',last_error='refresh reminder deduplicated',updated_at=now()
          FROM tracked_upgrades u WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.id<>$2
            AND n.notification_kind='refresh_required' AND n.status='pending' AND n.scheduled_at<=$3
        `,
          [row.account_id, row.id, now],
        );
      }
      claimed.push(row);
    }
    await client.query("COMMIT");
    return claimed.map((row) => ({
      id: String(row.id),
      upgradeId: String(row.upgrade_id),
      kind: row.notification_kind as NotificationKind,
      minutesBefore: Number(row.minutes_before),
      preparationMinutes: row.preparation_minutes == null ? null : Number(row.preparation_minutes),
      minutesRemaining: Math.max(0, Math.ceil((new Date(row.finish_at).getTime() - now.getTime()) / 60_000)),
      accountName: row.account_name,
      upgradeName: row.upgrade_name,
      nextLevel: row.next_level,
      finishAt: new Date(row.finish_at).toISOString(),
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markNotificationSent(id: string, now = new Date()): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE upgrade_notifications SET status='sent',sent_at=$2,locked_at=NULL,last_error=NULL,updated_at=now() WHERE id=$1",
      [id, now],
    );
    await client.query(
      `UPDATE resource_reminder_suppressions
      SET suppress_until=$2::timestamptz + (preparation_minutes * interval '1 minute'),updated_at=now()
      WHERE notification_id=$1`,
      [id, now],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markNotificationFailed(id: string, error: string, now = new Date()): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM resource_reminder_suppressions WHERE notification_id=$1", [id]);
    await client.query(
      `UPDATE upgrade_notifications SET status='pending',locked_at=NULL,last_error=$2,
      next_attempt_at=$3::timestamptz + LEAST(attempts * interval '30 seconds', interval '15 minutes'),updated_at=now() WHERE id=$1`,
      [id, error.slice(0, 500), now],
    );
    await client.query("COMMIT");
  } catch (failure) {
    await client.query("ROLLBACK");
    throw failure;
  } finally {
    client.release();
  }
}
