import test from "node:test";
import assert from "node:assert/strict";
import { completionEvents, isUpgradeActive, normalizeSnapshot, parseSnapshotDocuments } from "../../shared/snapshot.ts";

const account = { id: "main", label: "Main", color: "#123456" };

test("normalizes a compact village snapshot", () => {
  const snapshot = normalizeSnapshot(account, {
    capturedAt: "2026-07-16T10:00:00Z",
    village: { townHall: 17, builders: { free: 1, total: 6 }, upgrades: [{ id: "queen-97", name: "Archer Queen", type: "hero", level: 96, finishAt: "2026-07-17T10:00:00Z" }] },
  });
  assert.equal(snapshot.id, "main");
  assert.equal(snapshot.townHall, 17);
  assert.equal(snapshot.upgrades[0].nextLevel, 97);
  assert.equal(snapshot.resources, null);
});

test("treats an upgrade as active only before its finish time", () => {
  const finishAt = "2026-07-17T10:00:00Z";
  assert.equal(isUpgradeActive({ finishAt }, new Date("2026-07-17T09:59:59Z").getTime()), true);
  assert.equal(isUpgradeActive({ finishAt }, new Date(finishAt).getTime()), false);
  assert.equal(isUpgradeActive({ finishAt: "invalid" }), false);
});

test("emits deduplicatable completion and builder events", () => {
  const previous = normalizeSnapshot(account, { capturedAt: "2026-07-16T10:00:00Z", village: { builders: { free: 0, total: 6 }, upgrades: [{ id: "queen-97", name: "Archer Queen", type: "hero", level: 96, nextLevel: 97, finishAt: "2026-07-16T11:00:00Z" }] } });
  const current = normalizeSnapshot(account, { capturedAt: "2026-07-16T11:01:00Z", village: { builders: { free: 1, total: 6 }, upgrades: [] } });
  const events = completionEvents(previous, current);
  assert.deepEqual(events.map((event) => event.type), ["upgrade.completed", "builder.available"]);
  assert.match(events[0].body, /레벨 97/);
});

test("parses pretty JSON as one document and NDJSON line by line", () => {
  const pretty = `{\n  "village": { "name": "Main" }\n}`;
  assert.equal(parseSnapshotDocuments(pretty, "application/json").length, 1);
  assert.equal(parseSnapshotDocuments('{"id":1}\n{"id":2}\n', "application/x-ndjson").length, 2);
  assert.equal(parseSnapshotDocuments('[{"id":1},{"id":2}]', "application/json").length, 2);
  assert.equal(parseSnapshotDocuments('{"id":1}\n{"id":2}\n', "text/plain").length, 2);
});
