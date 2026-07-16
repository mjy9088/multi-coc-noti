import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { appendJsonl } from "@multi-coc/shared";
import type { SnapshotDocument, VillageSnapshot } from "@multi-coc/shared";

const DAY_MS = 86_400_000;
const datedFile = /^\d{4}-\d{2}-\d{2}\.jsonl$/;

export function dayKey(value: Date | string | number = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid snapshot date");
  return date.toISOString().slice(0, 10);
}

export async function appendSnapshotRecord(root: string, accountId: string, snapshot: { lastSeen: string; [key: string]: unknown }, source: unknown): Promise<string> {
  const file = path.join(root, "accounts", accountId, "snapshots", `${dayKey(snapshot.lastSeen)}.jsonl`);
  await appendJsonl(file, { capturedAt: snapshot.lastSeen, snapshot, source });
  return file;
}

async function files(directory: string, order: "asc" | "desc" = "desc"): Promise<string[]> {
  try {
    const names = (await readdir(directory)).filter((name) => datedFile.test(name)).sort();
    return order === "desc" ? names.reverse() : names;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export type SnapshotHistoryRecord = { capturedAt?: string; snapshot?: VillageSnapshot; source?: SnapshotDocument };
export async function readSnapshotHistory(root: string, accountId: string, limit = 100): Promise<SnapshotHistoryRecord[]> {
  const directory = path.join(root, "accounts", accountId, "snapshots");
  const records: SnapshotHistoryRecord[] = [];
  for (const name of await files(directory)) {
    const lines = (await readFile(path.join(directory, name), "utf8")).trim().split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines) {
      records.push(JSON.parse(line) as SnapshotHistoryRecord);
      if (records.length >= limit) return records;
    }
  }
  return records;
}

async function removeExpired(directory: string, retentionDays: number, now: Date): Promise<number> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0;
  const cutoff = dayKey(new Date(now.getTime() - retentionDays * DAY_MS));
  let removed = 0;
  for (const name of await files(directory, "asc")) {
    if (name.slice(0, 10) >= cutoff) continue;
    await unlink(path.join(directory, name));
    removed += 1;
  }
  return removed;
}

export async function cleanupRetention(root: string, accountIds: string[], { snapshotDays = 90, now = new Date() }: { snapshotDays?: number; now?: Date } = {}): Promise<{ snapshots: number }> {
  const snapshots = await Promise.all(accountIds.map((id) => removeExpired(path.join(root, "accounts", id, "snapshots"), snapshotDays, now)));
  return { snapshots: snapshots.reduce((sum, count) => sum + count, 0) };
}
