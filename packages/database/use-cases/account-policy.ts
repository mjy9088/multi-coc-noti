import type { Account, ResourceStatus } from "@multi-coc/shared";
import { database } from "../client.ts";
import type { AccountInput } from "../types.ts";
import { accountFromRow, rescheduleAccountNotifications } from "./notification-scheduling.ts";

export async function updateAccount(id: string, value: AccountInput): Promise<Account | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const previous = (
      await client.query("SELECT resource_status,resource_preparation_minutes FROM accounts WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    const { rows } = await client.query(
      `
      UPDATE accounts SET label=$2, player_tag=$3, color=$4, tags=$5,
        resource_status=COALESCE($6,resource_status),
        resource_status_updated_at=CASE WHEN $6::text IS NULL OR $6=resource_status THEN resource_status_updated_at ELSE now() END,
        resource_preparation_minutes=CASE WHEN $8 THEN $7 ELSE resource_preparation_minutes END, updated_at=now()
      WHERE id=$1 RETURNING *
    `,
      [
        id,
        value.label,
        value.playerTag || "",
        value.color || "#4c9a79",
        value.tags || [],
        value.resourceStatus ?? null,
        value.resourcePreparationMinutes ?? null,
        value.resourcePreparationMinutes !== undefined,
      ],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    const policyChanged =
      previous &&
      (previous.resource_status !== rows[0].resource_status ||
        previous.resource_preparation_minutes !== rows[0].resource_preparation_minutes);
    if (policyChanged) await rescheduleAccountNotifications(client, id);
    await client.query("COMMIT");
    return accountFromRow(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAccountResourceStatus(id: string, resourceStatus: ResourceStatus): Promise<Account | null> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE accounts
      SET resource_status=$2,resource_status_updated_at=now(),updated_at=now()
      WHERE id=$1 RETURNING *`,
      [id, resourceStatus],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    await rescheduleAccountNotifications(client, id);
    await client.query("COMMIT");
    return accountFromRow(rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
