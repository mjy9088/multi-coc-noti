import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlayerTag, parseVillageExport } from "../src/village-export.ts";

const now = Date.parse("2026-07-17T01:00:00Z");
const timestamp = Math.floor(now / 1000) - 60;

test("normalizes player tags and rejects invalid characters", () => {
  assert.equal(normalizePlayerTag(" 2p0j8lq "), "#2P0J8LQ");
  assert.throws(() => normalizePlayerTag("#ABC123"), /invalid player tag/);
});

test("parses active home and builder upgrades from an in-game export", () => {
  const result = parseVillageExport({
    tag: "#2P0J8LQ", timestamp,
    buildings: [
      { data: 1000001, lvl: 17 }, { data: 1000015, lvl: 6, cnt: 5 },
      { data: 1000008, lvl: 20, timer: 3600 },
    ],
    heroes: [{ data: 28000001, lvl: 96, timer: 7200 }],
    units: [{ data: 4000008, lvl: 11, timer: 1800 }],
    buildings2: [{ data: 1000065, lvl: 5 }, { data: 1000044, lvl: 10, timer: 900 }],
  }, { now });
  assert.equal(result.townHall, 17);
  assert.deepEqual(result.builders, { total: 6, free: 4 });
  assert.deepEqual(result.upgrades.map((upgrade) => upgrade.name), ["Cannon", "Archer Queen", "Dragon", "Cannon"]);
  assert.equal(result.upgrades[0].finishAt, new Date((timestamp + 3600) * 1000).toISOString());
});

test("rejects stale, future, and suspicious export values", () => {
  assert.throws(() => parseVillageExport({ tag: "#2P0J8LQ", timestamp: Math.floor(now / 1000) - 31 * 86400 }, { now }), /older than 30 days/);
  assert.throws(() => parseVillageExport({ tag: "#2P0J8LQ", timestamp: Math.floor(now / 1000) + 700 }, { now }), /future/);
  assert.throws(() => parseVillageExport({ tag: "#2P0J8LQ", timestamp, buildings: [{ data: 1000008, lvl: 2, timer: 181 * 86400 }] }, { now }), /invalid timer/);
});
