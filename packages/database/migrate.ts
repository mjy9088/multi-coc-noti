import { readFile } from "node:fs/promises";
import { database } from "./client.ts";

export async function migrate(): Promise<void> {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await database().query(schema);
}
