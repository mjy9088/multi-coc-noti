import { randomUUID } from "node:crypto";
import type { ResourceStatus } from "@multi-coc/shared";
import { database } from "../client.ts";
import type { ExportData, UpgradeSource, VillageHistoryBundle, VillageHistoryImportResult } from "../types.ts";
import { normalizeOffsets, rescheduleAccountNotifications } from "./notification-scheduling.ts";
import { syncTrackedUpgrades } from "./upgrade-tracking.ts";

export async function saveVillageExport(
  accountId: string,
  parsed: ExportData,
  options: { resourceStatus?: ResourceStatus } = {},
): Promise<{ exportedAt: string; normalized: ExportData; raw: unknown } | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT * FROM village_exports WHERE account_id=$1 ORDER BY exported_at DESC LIMIT 1 FOR UPDATE",
      [accountId],
    );
    const row = result.rows[0];
    const latest = row
      ? {
          exportedAt: new Date(row.exported_at).toISOString(),
          normalized: row.normalized as ExportData,
          raw: row.raw as unknown,
        }
      : null;
    if (latest && new Date(parsed.exportedAt) <= new Date(latest.exportedAt))
      throw new Error("village export is not newer than the stored export");
    const currentBuilderBase = parsed.upgradeSlots?.builderBase?.builders;
    const previousBuilderBase = latest?.normalized.upgradeSlots?.builderBase?.builders;
    if (currentBuilderBase && previousBuilderBase && previousBuilderBase.total > currentBuilderBase.total) {
      const busy = currentBuilderBase.total - currentBuilderBase.free;
      currentBuilderBase.total = previousBuilderBase.total;
      currentBuilderBase.free = Math.max(0, currentBuilderBase.total - busy);
    }
    await client.query(
      `
      INSERT INTO village_exports (account_id,player_tag,exported_at,raw,normalized)
      VALUES ($1,$2,$3,$4,$5)
    `,
      [
        accountId,
        parsed.tag,
        parsed.exportedAt,
        parsed.raw,
        {
          tag: parsed.tag,
          exportedAt: parsed.exportedAt,
          townHall: parsed.townHall,
          builders: parsed.builders,
          upgradeSlots: parsed.upgradeSlots,
          cooldowns: parsed.cooldowns,
          helpers: parsed.helpers,
          heroEquipment: parsed.heroEquipment,
          upgrades: parsed.upgrades,
          unknownDataIds: parsed.unknownDataIds,
        },
      ],
    );
    const account =
      parsed.upgrades.length > 0
        ? (await client.query("SELECT resource_status FROM accounts WHERE id=$1 FOR UPDATE", [accountId])).rows[0]
        : null;
    const nextResourceStatus = options.resourceStatus || "unanswered";
    if (account)
      await client.query(
        `UPDATE accounts SET resource_status=$2,resource_status_updated_at=now(),updated_at=now() WHERE id=$1`,
        [accountId, nextResourceStatus],
      );
    await syncTrackedUpgrades(accountId, "export", parsed.upgrades, parsed.exportedAt, client);
    if (account && account.resource_status !== nextResourceStatus)
      await rescheduleAccountNotifications(client, accountId);
    await client.query("COMMIT");
    return latest;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function exportVillageHistories(selector?: string): Promise<VillageHistoryBundle[]> {
  const selected = selector?.trim() || null;
  const { rows: accountRows } = await database().query(
    `
    SELECT * FROM accounts
    WHERE $1::text IS NULL OR id::text=$1 OR upper(player_tag)=upper($1) OR lower(label)=lower($1)
    ORDER BY lower(label),created_at
  `,
    [selected],
  );
  const bundles: VillageHistoryBundle[] = [];
  for (const row of accountRows) {
    const [exports, settings] = await Promise.all([
      database().query(
        "SELECT player_tag,exported_at,raw,normalized FROM village_exports WHERE account_id=$1 ORDER BY exported_at",
        [row.id],
      ),
      database().query(
        "SELECT source,source_key,notification_offsets,resource_preparation_override_minutes FROM tracked_upgrades WHERE account_id=$1 AND source='export' ORDER BY source_key",
        [row.id],
      ),
    ]);
    bundles.push({
      format: "multi-coc-village-exports",
      version: 2,
      exportedAt: new Date().toISOString(),
      account: {
        id: String(row.id),
        label: row.label,
        playerTag: row.player_tag,
        color: row.color,
        tags: ((row.tags as string[]) || []).map(String),
        resourceStatus: row.resource_status as ResourceStatus,
        resourceStatusUpdatedAt: new Date(row.resource_status_updated_at).toISOString(),
        resourcePreparationMinutes:
          row.resource_preparation_minutes == null ? null : Number(row.resource_preparation_minutes),
      },
      villageExports: exports.rows.map((item) => ({
        playerTag: item.player_tag,
        exportedAt: new Date(item.exported_at).toISOString(),
        raw: item.raw as unknown,
        normalized: item.normalized as ExportData,
      })),
      upgradeSettings: settings.rows.map((item) => ({
        source: item.source as UpgradeSource,
        sourceKey: item.source_key,
        notificationOffsets: normalizeOffsets(item.notification_offsets as number[]),
        resourcePreparationOverrideMinutes:
          item.resource_preparation_override_minutes == null
            ? null
            : Number(item.resource_preparation_override_minutes),
      })),
    });
  }
  return bundles;
}

export async function importVillageHistory(bundle: VillageHistoryBundle): Promise<VillageHistoryImportResult> {
  if (bundle.format !== "multi-coc-village-exports" || bundle.version !== 2)
    throw new Error("unsupported village history format");
  if (!bundle.account?.label || !Array.isArray(bundle.villageExports))
    throw new Error("invalid village history bundle");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const playerTag = String(bundle.account.playerTag || "");
    let accountRow = playerTag
      ? (await client.query("SELECT * FROM accounts WHERE upper(player_tag)=upper($1)", [playerTag])).rows[0]
      : null;
    if (!accountRow && !playerTag && bundle.account.id)
      accountRow = (await client.query("SELECT * FROM accounts WHERE id::text=$1", [bundle.account.id])).rows[0];
    let created = false;
    if (!accountRow) {
      const validOriginalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        bundle.account.id,
      );
      const idTaken =
        validOriginalId &&
        (await client.query("SELECT 1 FROM accounts WHERE id::text=$1", [bundle.account.id])).rowCount;
      const id = validOriginalId && !idTaken ? bundle.account.id : randomUUID();
      const result = await client.query(
        `
        INSERT INTO accounts (id,label,player_tag,color,tags,resource_status,resource_status_updated_at,resource_preparation_minutes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `,
        [
          id,
          bundle.account.label,
          playerTag,
          bundle.account.color || "#4c9a79",
          bundle.account.tags || [],
          bundle.account.resourceStatus || "unanswered",
          bundle.account.resourceStatusUpdatedAt || new Date().toISOString(),
          bundle.account.resourcePreparationMinutes === undefined ? 60 : bundle.account.resourcePreparationMinutes,
        ],
      );
      accountRow = result.rows[0];
      created = true;
    }
    const accountId = String(accountRow.id);
    const existingUpgradeIds = new Set(
      (await client.query("SELECT id FROM tracked_upgrades WHERE account_id=$1", [accountId])).rows.map((row) =>
        String(row.id),
      ),
    );
    let exportCount = 0;
    for (const item of bundle.villageExports) {
      const existing = (
        await client.query(
          "SELECT raw=$3::jsonb AS identical FROM village_exports WHERE account_id=$1 AND exported_at=$2",
          [accountId, item.exportedAt, item.raw],
        )
      ).rows[0];
      if (existing && !existing.identical) throw new Error(`conflicting export at ${item.exportedAt}`);
      const result = await client.query(
        `
        INSERT INTO village_exports (account_id,player_tag,exported_at,raw,normalized)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (account_id,exported_at) DO NOTHING
      `,
        [accountId, item.playerTag || playerTag, item.exportedAt, item.raw, item.normalized],
      );
      exportCount += result.rowCount || 0;
      await syncTrackedUpgrades(accountId, "export", item.normalized.upgrades || [], item.exportedAt, client, {
        reschedule: false,
      });
    }
    for (const setting of bundle.upgradeSettings || []) {
      const target = (
        await client.query("SELECT id FROM tracked_upgrades WHERE account_id=$1 AND source=$2 AND source_key=$3", [
          accountId,
          setting.source,
          setting.sourceKey,
        ])
      ).rows[0];
      if (!target || existingUpgradeIds.has(String(target.id))) continue;
      const offsets = normalizeOffsets(setting.notificationOffsets);
      await client.query(
        `
        UPDATE tracked_upgrades SET notification_offsets=$4,resource_preparation_override_minutes=$5,updated_at=now()
        WHERE account_id=$1 AND source=$2 AND source_key=$3
      `,
        [accountId, setting.source, setting.sourceKey, offsets, setting.resourcePreparationOverrideMinutes ?? null],
      );
    }
    await client.query(
      `
      DELETE FROM upgrade_notifications n USING tracked_upgrades u
      WHERE n.upgrade_id=u.id AND u.account_id=$1 AND n.status<>'sent'
        AND n.notification_kind='one_minute' AND n.scheduled_at<=now()
    `,
      [accountId],
    );
    await client.query(
      "UPDATE tracked_upgrades SET status='completed',updated_at=now() WHERE account_id=$1 AND status='active' AND finish_at<=now()",
      [accountId],
    );
    await rescheduleAccountNotifications(client, accountId);
    await client.query("COMMIT");
    return { accountId, label: accountRow.label, created, villageExports: exportCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
