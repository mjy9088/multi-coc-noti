import type pg from "pg";
import { database } from "../client.ts";
import type { DueChannelDelivery, NotificationKind } from "../types.ts";

const channelRuleQuery = `
  SELECT c.id AS channel_id,c.locale,b.base_url,b.device_key,b.default_group,b.icon_url,
    COALESCE(r.enabled,true) AS rule_enabled,r.sound,
    COALESCE(r.interruption_level,'active') AS interruption_level,r.critical_volume,
    COALESCE(r.repeat_sound,false) AS repeat_sound,r.group_name,r.target_url,r.archive,r.archive_ttl_seconds
  FROM notification_channels c
  JOIN bark_channel_settings b ON b.channel_id=c.id
  LEFT JOIN notification_delivery_rules r ON r.channel_id=c.id AND r.notification_kind=$1
  WHERE c.enabled AND c.user_id=$2 AND b.device_key<>'' AND COALESCE(r.enabled,true)
  ORDER BY c.created_at,c.id
`;

async function configuredChannelCount(client: pg.PoolClient): Promise<number> {
  const result = await client.query(`
    SELECT count(*)::integer AS count FROM notification_channels c
    JOIN bark_channel_settings b ON b.channel_id=c.id
    WHERE c.enabled AND c.user_id IS NOT NULL AND b.device_key<>''
  `);
  return Number(result.rows[0]?.count ?? 0);
}

export async function claimDueChannelDeliveries(limit = 20, now = new Date()): Promise<DueChannelDelivery[] | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    if ((await configuredChannelCount(client)) === 0) {
      await client.query("COMMIT");
      return null;
    }

    await client.query(
      `UPDATE upgrade_notifications SET status='skipped',locked_at=NULL,last_error='reminder window missed',updated_at=now()
       WHERE notification_kind='one_minute' AND status IN ('pending','processing')
         AND scheduled_at<$1::timestamptz-interval '2 minutes'`,
      [now],
    );

    const candidates = await client.query(
      `
      SELECT n.id,n.notification_kind,n.preparation_minutes,u.account_id,a.user_id
      FROM upgrade_notifications n
      JOIN tracked_upgrades u ON u.id=n.upgrade_id
      JOIN accounts a ON a.id=u.account_id
      WHERE u.status IN ('active','completed') AND n.scheduled_at<=$1 AND n.next_attempt_at<=$1
        AND (n.status='pending' OR (n.status='processing' AND n.locked_at<$1-interval '5 minutes'))
        AND (n.notification_kind<>'refresh_required' OR NOT EXISTS (
          SELECT 1 FROM village_exports e WHERE e.account_id=u.account_id AND e.exported_at>u.finish_at
        ))
      ORDER BY n.scheduled_at FOR UPDATE OF n SKIP LOCKED LIMIT $2
      `,
      [now, limit],
    );
    const refreshAccounts = new Set<string>();
    for (const event of candidates.rows) {
      const accountId = String(event.account_id);
      if (event.notification_kind === "refresh_required" && refreshAccounts.has(accountId)) {
        await client.query(
          "UPDATE upgrade_notifications SET status='skipped',last_error='refresh reminder deduplicated',updated_at=now() WHERE id=$1",
          [event.id],
        );
        continue;
      }

      const channels = await client.query(channelRuleQuery, [event.notification_kind, event.user_id]);
      let recipients = 0;
      for (const channel of channels.rows) {
        if (event.notification_kind === "resource_preparation") {
          const suppression = await client.query(
            `
            INSERT INTO notification_delivery_suppressions
              (account_id,channel_id,notification_id,suppress_until,preparation_minutes)
            VALUES ($1,$2,$3,$4::timestamptz+($5*interval '1 minute'),$5)
            ON CONFLICT (account_id,channel_id) DO UPDATE SET notification_id=EXCLUDED.notification_id,
              suppress_until=EXCLUDED.suppress_until,preparation_minutes=EXCLUDED.preparation_minutes,updated_at=now()
            WHERE notification_delivery_suppressions.suppress_until<=$4
              OR notification_delivery_suppressions.notification_id=$3
            RETURNING notification_id
            `,
            [accountId, channel.channel_id, event.id, now, event.preparation_minutes],
          );
          if (!suppression.rowCount) continue;
        }
        await client.query(
          `INSERT INTO notification_deliveries (notification_id,channel_id,next_attempt_at)
           VALUES ($1,$2,$3) ON CONFLICT (notification_id,channel_id) DO NOTHING`,
          [event.id, channel.channel_id, now],
        );
        recipients += 1;
      }
      if (recipients === 0) {
        await client.query(
          "UPDATE upgrade_notifications SET status='skipped',locked_at=NULL,last_error='no enabled delivery channel',updated_at=now() WHERE id=$1",
          [event.id],
        );
        continue;
      }
      await client.query(
        "UPDATE upgrade_notifications SET status='processing',locked_at=$2,attempts=attempts+1,updated_at=now() WHERE id=$1",
        [event.id, now],
      );
      if (event.notification_kind === "refresh_required") {
        refreshAccounts.add(accountId);
        await client.query(
          `UPDATE upgrade_notifications n SET status='skipped',last_error='refresh reminder deduplicated',updated_at=now()
           FROM tracked_upgrades u WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.id<>$2
             AND n.notification_kind='refresh_required' AND n.status='pending' AND n.scheduled_at<=$3`,
          [accountId, event.id, now],
        );
      }
    }

    await client.query(
      `UPDATE notification_deliveries d SET status='skipped',locked_at=NULL,last_error='delivery channel disabled',updated_at=now()
       WHERE d.status IN ('pending','processing') AND (
         NOT EXISTS (SELECT 1 FROM notification_channels c JOIN bark_channel_settings b ON b.channel_id=c.id
           WHERE c.id=d.channel_id AND c.enabled AND b.device_key<>'')
         OR EXISTS (SELECT 1 FROM notification_delivery_rules r JOIN upgrade_notifications n ON n.id=d.notification_id
           WHERE r.channel_id=d.channel_id AND r.notification_kind=n.notification_kind AND NOT r.enabled)
       )`,
    );
    await client.query(
      `UPDATE upgrade_notifications n SET
         status=CASE WHEN EXISTS (
           SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id AND d.status='sent'
         ) THEN 'sent' ELSE 'skipped' END,
         sent_at=COALESCE(n.sent_at,(
           SELECT max(d.sent_at) FROM notification_deliveries d WHERE d.notification_id=n.id AND d.status='sent'
         )),locked_at=NULL,
         last_error=CASE WHEN EXISTS (
           SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id AND d.status='sent'
         ) THEN NULL ELSE 'all channel deliveries skipped' END,updated_at=now()
       WHERE n.status='processing'
         AND EXISTS (SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id)
         AND NOT EXISTS (
           SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id AND d.status IN ('pending','processing')
         )`,
    );
    const claimed = await client.query(
      `
      SELECT d.id AS delivery_id,d.channel_id,n.id,n.upgrade_id,n.notification_kind,n.minutes_before,n.preparation_minutes,
        a.label AS account_name,u.name AS upgrade_name,u.next_level,u.finish_at,
        c.locale,b.base_url,b.device_key,b.default_group,b.icon_url,r.sound,
        COALESCE(r.enabled,true) AS rule_enabled,COALESCE(r.interruption_level,'active') AS interruption_level,
        r.critical_volume,COALESCE(r.repeat_sound,false) AS repeat_sound,r.group_name,r.target_url,r.archive,r.archive_ttl_seconds
      FROM notification_deliveries d
      JOIN upgrade_notifications n ON n.id=d.notification_id
      JOIN tracked_upgrades u ON u.id=n.upgrade_id JOIN accounts a ON a.id=u.account_id
      JOIN notification_channels c ON c.id=d.channel_id AND c.enabled
      JOIN bark_channel_settings b ON b.channel_id=c.id AND b.device_key<>''
      LEFT JOIN notification_delivery_rules r ON r.channel_id=c.id AND r.notification_kind=n.notification_kind
      WHERE d.next_attempt_at<=$1
        AND (d.status='pending' OR (d.status='processing' AND d.locked_at<$1-interval '5 minutes'))
        AND COALESCE(r.enabled,true) AND u.status IN ('active','completed')
        AND (n.notification_kind<>'refresh_required' OR NOT EXISTS (
          SELECT 1 FROM village_exports e WHERE e.account_id=u.account_id AND e.exported_at>u.finish_at
        ))
      ORDER BY n.scheduled_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT $2
      `,
      [now, limit],
    );
    for (const row of claimed.rows) {
      await client.query(
        "UPDATE notification_deliveries SET status='processing',locked_at=$2,attempts=attempts+1,updated_at=now() WHERE id=$1",
        [row.delivery_id, now],
      );
    }
    await client.query("COMMIT");
    return claimed.rows.map((row) => ({
      id: String(row.id),
      deliveryId: String(row.delivery_id),
      upgradeId: String(row.upgrade_id),
      kind: row.notification_kind as NotificationKind,
      minutesBefore: Number(row.minutes_before),
      preparationMinutes: row.preparation_minutes == null ? null : Number(row.preparation_minutes),
      minutesRemaining: Math.max(0, Math.ceil((new Date(row.finish_at).getTime() - now.getTime()) / 60_000)),
      accountName: row.account_name,
      upgradeName: row.upgrade_name,
      nextLevel: row.next_level,
      finishAt: new Date(row.finish_at).toISOString(),
      channel: {
        id: String(row.channel_id),
        baseUrl: row.base_url,
        deviceKey: row.device_key,
        defaultGroup: row.default_group,
        iconUrl: row.icon_url,
        locale: row.locale,
      },
      rule: {
        enabled: row.rule_enabled,
        sound: row.sound,
        interruptionLevel: row.interruption_level,
        criticalVolume: row.critical_volume == null ? null : Number(row.critical_volume),
        repeatSound: row.repeat_sound,
        groupName: row.group_name,
        targetUrl: row.target_url,
        archive: row.archive,
        archiveTtlSeconds: row.archive_ttl_seconds == null ? null : Number(row.archive_ttl_seconds),
      },
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markChannelDeliverySent(deliveryId: string, now = new Date()): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE notification_deliveries SET status='sent',sent_at=$2,locked_at=NULL,last_error=NULL,updated_at=now()
       WHERE id=$1 RETURNING notification_id,channel_id`,
      [deliveryId, now],
    );
    const delivery = result.rows[0];
    if (delivery) {
      await client.query(
        `UPDATE notification_delivery_suppressions SET
          suppress_until=$2::timestamptz+(preparation_minutes*interval '1 minute'),updated_at=now()
         WHERE notification_id=$1 AND channel_id=$3`,
        [delivery.notification_id, now, delivery.channel_id],
      );
      await client.query(
        `UPDATE upgrade_notifications n SET status='sent',sent_at=$2,locked_at=NULL,last_error=NULL,updated_at=now()
         WHERE n.id=$1 AND NOT EXISTS (
           SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id AND d.status IN ('pending','processing')
         )`,
        [delivery.notification_id, now],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markChannelDeliveryFailed(deliveryId: string, error: string, now = new Date()): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE notification_deliveries SET status='pending',locked_at=NULL,last_error=$2,
        next_attempt_at=$3::timestamptz+LEAST(attempts*interval '30 seconds',interval '15 minutes'),updated_at=now()
       WHERE id=$1 RETURNING notification_id,channel_id`,
      [deliveryId, error.slice(0, 500), now],
    );
    const delivery = result.rows[0];
    if (delivery) {
      await client.query("DELETE FROM notification_delivery_suppressions WHERE notification_id=$1 AND channel_id=$2", [
        delivery.notification_id,
        delivery.channel_id,
      ]);
    }
    await client.query("COMMIT");
  } catch (failure) {
    await client.query("ROLLBACK");
    throw failure;
  } finally {
    client.release();
  }
}
