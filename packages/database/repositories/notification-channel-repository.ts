import { database } from "../client.ts";

export type BarkChannelInput = {
  label: string;
  enabled: boolean;
  locale: "ko" | "en";
  baseUrl: string;
  deviceKey?: string;
  defaultGroup?: string | null;
  iconUrl?: string | null;
};

export async function listNotificationChannels(userId: string) {
  const { rows } = await database().query(
    `SELECT c.id,c.label,c.enabled,c.locale,b.base_url,b.default_group,b.icon_url,
      right(b.device_key,4) AS device_key_suffix
     FROM notification_channels c JOIN bark_channel_settings b ON b.channel_id=c.id
     WHERE c.user_id=$1 ORDER BY c.created_at,c.id`,
    [userId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    label: row.label,
    enabled: row.enabled,
    locale: row.locale as "ko" | "en",
    baseUrl: row.base_url,
    defaultGroup: row.default_group,
    iconUrl: row.icon_url,
    deviceKeySuffix: row.device_key_suffix,
  }));
}

export async function saveBarkChannel(userId: string, input: BarkChannelInput, id?: string) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = id
      ? await client.query(
          `UPDATE notification_channels SET label=$3,enabled=$4,locale=$5,updated_at=now()
           WHERE id=$1 AND user_id=$2 RETURNING id`,
          [id, userId, input.label, input.enabled, input.locale],
        )
      : await client.query(
          `INSERT INTO notification_channels (user_id,label,channel_type,enabled,locale)
           VALUES ($1,$2,'bark',$3,$4) RETURNING id`,
          [userId, input.label, input.enabled, input.locale],
        );
    const channelId = result.rows[0]?.id;
    if (!channelId) {
      await client.query("ROLLBACK");
      return null;
    }
    if (!id && !input.deviceKey) throw new Error("Bark device key is required");
    await client.query(
      `INSERT INTO bark_channel_settings (channel_id,base_url,device_key,default_group,icon_url)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (channel_id) DO UPDATE SET base_url=EXCLUDED.base_url,
         device_key=CASE WHEN EXCLUDED.device_key='' THEN bark_channel_settings.device_key ELSE EXCLUDED.device_key END,
         default_group=EXCLUDED.default_group,icon_url=EXCLUDED.icon_url,updated_at=now()`,
      [channelId, input.baseUrl, input.deviceKey || "", input.defaultGroup || null, input.iconUrl || null],
    );
    await client.query("COMMIT");
    return (await listNotificationChannels(userId)).find((channel) => channel.id === String(channelId)) ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteNotificationChannel(userId: string, id: string): Promise<boolean> {
  const result = await database().query("DELETE FROM notification_channels WHERE id=$1 AND user_id=$2 RETURNING id", [
    id,
    userId,
  ]);
  return Boolean(result.rowCount);
}
