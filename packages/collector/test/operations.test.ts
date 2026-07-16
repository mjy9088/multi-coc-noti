import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRateLimiter } from "../src/rate-limit.ts";
import { appendSnapshotRecord, cleanupRetention, readSnapshotHistory } from "../src/storage.ts";

test("[OPS-RATE-001] rate limiter resets after its window", () => {
  let timestamp = 1_000;
  const consume = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => timestamp });
  assert.equal(consume("1:local").allowed, true);
  assert.equal(consume("1:local").allowed, true);
  assert.equal(consume("1:local").allowed, false);
  timestamp = 2_001;
  assert.equal(consume("1:local").allowed, true);
});

test("[OPS-HISTORY-001] rotates snapshot JSONL by UTC date and reads newest history first", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "multi-coc-storage-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const older = { id: "1", name: "Main", lastSeen: "2026-07-15T23:50:00Z", builders: { free: 0, total: 6 }, resources: {}, upgrades: [] };
  const newer = { ...older, lastSeen: "2026-07-16T00:10:00Z", builders: { free: 1, total: 6 } };
  await appendSnapshotRecord(root, "1", older, { village: { name: "Main" } });
  await appendSnapshotRecord(root, "1", newer, { village: { name: "Main" } });
  const history = await readSnapshotHistory(root, "1", 10);
  assert.deepEqual(history.map((record) => record.capturedAt), [newer.lastSeen, older.lastSeen]);
});

test("[OPS-RETENTION-001] removes only dated files outside retention", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "multi-coc-retention-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await appendSnapshotRecord(root, "1", { id: "1", lastSeen: "2026-01-01T00:00:00Z" }, {});
  await appendSnapshotRecord(root, "1", { id: "1", lastSeen: "2026-07-16T00:00:00Z" }, {});
  const result = await cleanupRetention(root, ["1"], { snapshotDays: 30, now: new Date("2026-07-17T00:00:00Z") });
  assert.deepEqual(result, { snapshots: 1 });
  assert.equal((await readSnapshotHistory(root, "1", 10)).length, 1);
});
