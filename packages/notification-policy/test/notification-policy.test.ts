import assert from "node:assert/strict";
import test from "node:test";
import {
  planRefreshNotification,
  planResourceNotifications,
  resolvePreparationMinutes,
} from "@multi-coc/notification-policy";

test("[ALERT-PLAN-001] plans notifications from the village resource policy", () => {
  const now = new Date("2026-07-17T09:30:00Z");
  const finish = "2026-07-17T10:00:00Z";
  assert.deepEqual(
    planResourceNotifications("abundant", 60, finish, now).map((item) => item.kind),
    ["completion"],
  );
  assert.deepEqual(
    planResourceNotifications("sufficient", 60, finish, now).map((item) => item.kind),
    ["one_minute"],
  );
  const insufficient = planResourceNotifications("insufficient", 60, "2026-07-17T11:00:00Z", now);
  assert.deepEqual(
    insufficient.map((item) => item.kind),
    ["resource_preparation", "completion"],
  );
  assert.equal(insufficient[0].scheduledAt.toISOString(), "2026-07-17T10:00:00.000Z");
  assert.deepEqual(
    planResourceNotifications("insufficient", 60, finish, now).map((item) => item.kind),
    ["completion"],
  );
  assert.deepEqual(
    planResourceNotifications("unanswered", null, finish, now).map((item) => item.kind),
    ["completion"],
  );
});

test("[ALERT-REFRESH-001] schedules the stale-village reminder 24 hours after completion", () => {
  assert.equal(planRefreshNotification("2026-07-17T10:00:00Z").toISOString(), "2026-07-18T10:00:00.000Z");
});

test("[ALERT-OVERRIDE-001] resolves per-upgrade preparation overrides", () => {
  assert.equal(resolvePreparationMinutes(60, null), 60);
  assert.equal(resolvePreparationMinutes(60, 0), null);
  assert.equal(resolvePreparationMinutes(60, 120), 120);
  assert.equal(resolvePreparationMinutes(null, 30), 30);
});
