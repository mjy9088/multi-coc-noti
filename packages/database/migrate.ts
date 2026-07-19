import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { migrate as runDrizzleMigrations } from "drizzle-orm/node-postgres/migrator";
import { database, drizzleDatabase } from "./client.ts";

type MigrationJournal = {
  entries: Array<{ when: number; tag: string }>;
};

const migrationLockId = 1_839_085_028;

async function baselineExistingDatabase(): Promise<void> {
  const schema = await readFile(new URL("./legacy-schema.sql", import.meta.url), "utf8");
  const journal = JSON.parse(
    await readFile(new URL("./drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ) as MigrationJournal;
  const initial = journal.entries[0];
  if (!initial) throw new Error("Drizzle migration journal has no baseline migration");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(schema);
    const markers = (
      await client.query(`SELECT
        to_regclass('public.notification_channels') IS NOT NULL AS has_delivery_channels,
        to_regclass('public.users') IS NOT NULL AND
          to_regclass('public.user_dashboard_settings') IS NOT NULL AS has_user_ownership`)
    ).rows[0];
    const baselines = journal.entries.filter(
      (entry) =>
        entry.tag === initial.tag ||
        (entry.tag === "0001_notification-delivery-channels" && markers.has_delivery_channels) ||
        (entry.tag === "0002_user-auth-ownership" && markers.has_user_ownership),
    );
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )`);
    for (const baseline of baselines) {
      const migration = await readFile(new URL(`./drizzle/${baseline.tag}.sql`, import.meta.url), "utf8");
      const hash = createHash("sha256").update(migration).digest("hex");
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
         SELECT $1, $2 WHERE NOT EXISTS (
           SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash=$1 OR created_at=$2
         )`,
        [hash, baseline.when],
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

export async function migrate(): Promise<void> {
  const lockClient = await database().connect();
  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [migrationLockId]);
    const state = (
      await lockClient.query(`SELECT
        to_regclass('public.accounts') IS NOT NULL AS has_application_schema,
        to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_migration_journal`)
    ).rows[0];
    if (state.has_application_schema && !state.has_migration_journal) await baselineExistingDatabase();
    await runDrizzleMigrations(drizzleDatabase(), {
      migrationsFolder: fileURLToPath(new URL("./drizzle", import.meta.url)),
    });
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [migrationLockId]).catch(() => undefined);
    lockClient.release();
  }
}
