import test from "node:test";
import assert from "node:assert/strict";
import { isUpgradeActive, isVillageRefreshRequired, normalizeAccountTags } from "../../shared/index.ts";

test("[DATA-UPGRADE-001] treats an upgrade as active only before its finish time", () => {
  const finishAt = "2026-07-17T10:00:00Z";
  assert.equal(isUpgradeActive({ finishAt }, new Date("2026-07-17T09:59:59Z").getTime()), true);
  assert.equal(isUpgradeActive({ finishAt }, new Date(finishAt).getTime()), false);
  assert.equal(isUpgradeActive({ finishAt: "invalid" }), false);
});

test("[DATA-REFRESH-001] requires a village update 30 minutes after an unobserved completion", () => {
  const finishAt = "2026-07-17T10:00:00Z";
  assert.equal(isVillageRefreshRequired("2026-07-17T09:00:00Z", finishAt, Date.parse("2026-07-17T10:29:59Z")), false);
  assert.equal(isVillageRefreshRequired("2026-07-17T09:00:00Z", finishAt, Date.parse("2026-07-17T10:30:00Z")), true);
  assert.equal(isVillageRefreshRequired("2026-07-17T10:01:00Z", finishAt, Date.parse("2026-07-18T10:00:00Z")), false);
});

test("[DATA-TAGS-001] normalizes comma-separated account tags case-insensitively", () => {
  assert.deepEqual(normalizeAccountTags(" Main, #war, main,  Mini "), ["Main", "war", "Mini"]);
  assert.deepEqual(normalizeAccountTags(undefined, ["Existing"]), ["Existing"]);
});
