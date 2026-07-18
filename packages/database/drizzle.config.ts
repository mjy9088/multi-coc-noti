import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL || "postgresql://coc:coc@127.0.0.1:5432/multi_coc" },
  strict: true,
  verbose: true,
});
