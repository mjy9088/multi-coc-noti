import type { Upgrade } from "@multi-coc/shared";
import type pg from "pg";
import { database } from "../client.ts";
import { upgradeFromRow } from "../repositories/upgrade-repository.ts";
import type { TrackedUpgrade, UpgradeSource } from "../types.ts";
import { rescheduleAccountNotifications } from "./notification-scheduling.ts";

export async function updateUpgradePreparationOverride(
  id: string,
  overrideMinutes: number | null,
  userId?: string,
): Promise<TrackedUpgrade | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE tracked_upgrades
      SET resource_preparation_override_minutes=$2,updated_at=now()
      WHERE id=$1 AND ($3::text IS NULL OR EXISTS (
        SELECT 1 FROM accounts a WHERE a.id=tracked_upgrades.account_id AND a.user_id=$3
      )) RETURNING id, account_id AS "accountId", source, source_key AS "sourceKey", name, type, base,
        current_level AS "currentLevel", next_level AS "nextLevel", started_at AS "startedAt", finish_at AS "finishAt",
        status, notification_offsets AS "notificationOffsets",
        resource_preparation_override_minutes AS "resourcePreparationOverrideMinutes",
        last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, overrideMinutes, userId ?? null],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await rescheduleAccountNotifications(client, String(rows[0].accountId));
    await client.query("COMMIT");
    return upgradeFromRow(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeDueTrackedUpgrades(now = new Date()): Promise<TrackedUpgrade[]> {
  const { rows } = await database().query(
    `
    UPDATE tracked_upgrades SET status='completed',updated_at=now()
    WHERE status='active' AND finish_at <= $1
    RETURNING id, account_id AS "accountId", source, source_key AS "sourceKey", name, type, base,
      current_level AS "currentLevel", next_level AS "nextLevel", started_at AS "startedAt", finish_at AS "finishAt",
      status, notification_offsets AS "notificationOffsets",
      resource_preparation_override_minutes AS "resourcePreparationOverrideMinutes",
      last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"
  `,
    [now],
  );
  return rows.map(upgradeFromRow);
}

export async function syncTrackedUpgrades(
  accountId: string,
  source: UpgradeSource,
  upgrades: Upgrade[],
  observedAt: string,
  transactionClient?: pg.PoolClient,
  options: { reschedule?: boolean } = {},
): Promise<void> {
  const client = transactionClient || (await database().connect());
  const ownsTransaction = !transactionClient;
  try {
    if (ownsTransaction) await client.query("BEGIN");
    const keys: string[] = [];
    let trackerChanged = false;
    for (const upgrade of upgrades) {
      const sourceKey = upgrade.id;
      keys.push(sourceKey);
      let existing = (
        await client.query(
          "SELECT id,finish_at,status FROM tracked_upgrades WHERE account_id=$1 AND source=$2 AND source_key=$3",
          [accountId, source, sourceKey],
        )
      ).rows[0];
      if (!existing && source === "export") {
        existing = (
          await client.query(
            `
          SELECT id,finish_at,status FROM tracked_upgrades
          WHERE account_id=$1 AND source='export' AND status='active' AND type=$2 AND base=$3
            AND lower(name)=lower($4) AND next_level=$5 AND finish_at=$6
          ORDER BY id LIMIT 1
        `,
            [
              accountId,
              upgrade.type,
              upgrade.base === "builder" ? "builder" : "home",
              upgrade.name,
              upgrade.nextLevel,
              upgrade.finishAt,
            ],
          )
        ).rows[0];
        if (existing)
          await client.query("UPDATE tracked_upgrades SET source_key=$2,updated_at=now() WHERE id=$1", [
            existing.id,
            sourceKey,
          ]);
      }
      const { rows } = await client.query(
        `
        INSERT INTO tracked_upgrades (account_id,source,source_key,name,type,base,current_level,next_level,started_at,finish_at,status,last_seen_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)
        ON CONFLICT (account_id,source,source_key) DO UPDATE SET
          name=EXCLUDED.name,type=EXCLUDED.type,base=EXCLUDED.base,current_level=EXCLUDED.current_level,next_level=EXCLUDED.next_level,
          started_at=EXCLUDED.started_at,finish_at=EXCLUDED.finish_at,status='active',last_seen_at=EXCLUDED.last_seen_at,updated_at=now()
        RETURNING *
      `,
        [
          accountId,
          source,
          sourceKey,
          upgrade.name,
          upgrade.type,
          upgrade.base === "builder" ? "builder" : "home",
          upgrade.level,
          upgrade.nextLevel,
          upgrade.startedAt || observedAt,
          upgrade.finishAt,
          observedAt,
        ],
      );
      if (
        existing?.status !== "active" ||
        new Date(existing.finish_at).getTime() !== new Date(upgrade.finishAt).getTime()
      )
        trackerChanged = true;
      const duplicates = await client.query(
        `
        UPDATE tracked_upgrades SET status='cancelled',updated_at=now()
        WHERE account_id=$1 AND id<>$2 AND status='active' AND type=$3 AND lower(name)=lower($4) AND next_level=$5
        RETURNING id
      `,
        [accountId, rows[0].id, upgrade.type, upgrade.name, upgrade.nextLevel],
      );
      if (duplicates.rowCount) trackerChanged = true;
      for (const row of duplicates.rows)
        await client.query("DELETE FROM upgrade_notifications WHERE upgrade_id=$1 AND status <> 'sent'", [row.id]);
    }
    const result = await client.query(
      `
      UPDATE tracked_upgrades SET status=CASE WHEN finish_at <= $4 THEN 'completed' ELSE 'cancelled' END,updated_at=now()
      WHERE account_id=$1 AND source=$2 AND status='active' AND NOT (source_key = ANY($3::text[])) RETURNING id,status
    `,
      [accountId, source, keys, observedAt],
    );
    if (result.rowCount) trackerChanged = true;
    for (const row of result.rows)
      await client.query(
        `DELETE FROM upgrade_notifications
      WHERE upgrade_id=$1 AND status<>'sent' AND ($2<>'completed' OR notification_kind<>'completion')`,
        [row.id, row.status],
      );
    if (trackerChanged && options.reschedule !== false) await rescheduleAccountNotifications(client, accountId);
    if (ownsTransaction) await client.query("COMMIT");
  } catch (error) {
    if (ownsTransaction) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
}
