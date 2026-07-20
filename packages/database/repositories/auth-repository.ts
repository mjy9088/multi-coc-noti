import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { database, drizzleDatabase } from "../client.ts";
import { authSessions, users } from "../schema.ts";

export type AuthenticatedUser = { id: string; name: string | null; email: string | null; image: string | null };

export function localTestUserId(username: string): string {
  return `test-${createHash("sha256").update(username).digest("hex").slice(0, 32)}`;
}

export async function ensureLocalTestUser(username: string): Promise<string> {
  const userId = localTestUserId(username);
  await database().query(
    `INSERT INTO users (id,name) VALUES ($1,$2)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,updated_at=now()`,
    [userId, username],
  );
  return userId;
}

export async function createLocalTestSession({
  userId,
  username,
  sessionToken,
  expires,
}: {
  userId: string;
  username: string;
  sessionToken: string;
  expires: Date;
}): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO users (id,name) VALUES ($1,$2)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,updated_at=now()`,
      [userId, username],
    );
    await client.query(
      `INSERT INTO auth_sessions (session_token,user_id,expires) VALUES ($1,$2,$3)
       ON CONFLICT (session_token) DO UPDATE SET user_id=EXCLUDED.user_id,expires=EXCLUDED.expires`,
      [sessionToken, userId, expires],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await claimUnownedLegacyData(userId);
}

export async function authenticateSessionToken(
  sessionToken: string,
  now = new Date(),
): Promise<AuthenticatedUser | null> {
  const [row] = await drizzleDatabase()
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.sessionToken, sessionToken), gt(authSessions.expires, now)))
    .limit(1);
  return row ?? null;
}

export async function claimUnownedLegacyData(userId: string): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [1_839_085_029]);
    const firstClaim = await client.query(
      `INSERT INTO app_migrations (key) VALUES ('auth-first-user-legacy-claim-v1')
       ON CONFLICT DO NOTHING RETURNING key`,
    );
    if (firstClaim.rowCount) {
      await client.query("UPDATE accounts SET user_id=$1 WHERE user_id IS NULL", [userId]);
      await client.query("UPDATE notification_channels SET user_id=$1 WHERE user_id IS NULL", [userId]);
      await client.query(
        `INSERT INTO user_dashboard_settings (user_id,group_order)
         SELECT $1,group_order FROM dashboard_settings WHERE singleton=true
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
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
