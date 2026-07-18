import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { schema } from "./schema.ts";

const { Pool } = pg;
let pool: pg.Pool | undefined;

export function database(): pg.Pool {
  if (!pool)
    pool = process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL })
      : new Pool({
          host: process.env.PGHOST || "127.0.0.1",
          port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
          database: process.env.PGDATABASE || "multi_coc",
          user: process.env.PGUSER || "coc",
          password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "coc",
        });
  return pool;
}

export type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

export function drizzleDatabase(): DrizzleDatabase {
  return drizzle(database(), { schema, casing: "snake_case" });
}

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
