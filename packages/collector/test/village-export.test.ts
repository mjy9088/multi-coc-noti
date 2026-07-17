import assert from "node:assert/strict";
import test from "node:test";
import { compareVillageExports, normalizePlayerTag, parseVillageExport } from "../src/village-export.ts";

const now = Date.parse("2026-07-17T01:00:00Z");
const timestamp = Math.floor(now / 1000) - 60;

test("[IMPORT-TAG-001] normalizes player tags and rejects invalid characters", () => {
  assert.equal(normalizePlayerTag(" 2p0j8lq "), "#2P0J8LQ");
  assert.throws(() => normalizePlayerTag("#ABC123"), /invalid player tag/);
});

test("[IMPORT-PARSE-001] parses active home and builder upgrades from an in-game export", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000001, lvl: 17 },
        { data: 1000015, lvl: 6, cnt: 5 },
        { data: 1000008, lvl: 20, timer: 3600 },
        { data: 1000007, lvl: 15 },
        { data: 1000068, lvl: 10 },
      ],
      heroes: [{ data: 28000001, lvl: 96, timer: 7200 }],
      units: [{ data: 4000008, lvl: 11, timer: 1800 }],
      pets: [{ data: 73000000, lvl: 10, timer: 1200 }],
      buildings2: [
        { data: 1000065, lvl: 5 },
        { data: 1000078, lvl: 1 },
        { data: 1000046, lvl: 10 },
        { data: 1000044, lvl: 10, timer: 900 },
      ],
    },
    { now },
  );
  assert.equal(result.townHall, 17);
  assert.deepEqual(result.builders, { total: 6, free: 4, regularTotal: 6 });
  assert.deepEqual(result.upgradeSlots, {
    laboratory: { available: false, active: 1, total: 1 },
    petHouse: { available: false },
    builderBase: { builders: { total: 2, free: 1 }, laboratory: { available: true, active: 0, total: 1 } },
  });
  assert.deepEqual(
    result.upgrades.map((upgrade) => upgrade.name),
    ["Cannon", "Archer Queen", "Dragon", "L.A.S.S.I", "Cannon"],
  );
  assert.equal(result.upgrades[0].finishAt, new Date((timestamp + 3600) * 1000).toISOString());
});

test("[IMPORT-COOLDOWN-001] converts exported Clock Tower and helper cooldowns to absolute times", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      boosts: { clocktower_cooldown: 3600 },
      helpers: [{ data: 93000000, helper_cooldown: 7200 }, { data: 93000001 }, { data: 93000002, helper_cooldown: -1 }],
    },
    { now },
  );
  assert.deepEqual(result.cooldowns, {
    clockTower: new Date((timestamp + 3600) * 1000).toISOString(),
    helpers: [{ dataId: 93000000, availableAt: new Date((timestamp + 7200) * 1000).toISOString() }],
  });
});

test("[IMPORT-DETAIL-001] maps helper and Hero Equipment levels for village details", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      helpers: [{ data: 93000000, lvl: 8, helper_cooldown: 60 }],
      equipment: [{ data: 90000001, lvl: 18 }],
    },
    { now },
  );
  assert.deepEqual(result.helpers, [
    {
      dataId: 93000000,
      name: "Builder's Apprentice",
      level: 8,
      availableAt: new Date((timestamp + 60) * 1000).toISOString(),
    },
  ]);
  assert.deepEqual(result.heroEquipment, [{ dataId: 90000001, name: "Rage Vial", level: 18 }]);
});

test("[IMPORT-KEY-001] keeps upgrade keys stable when unrelated export entries reorder", () => {
  const first = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000008, lvl: 20, timer: 3600 },
        { data: 1000010, lvl: 12, timer: 7200 },
      ],
    },
    { now },
  );
  const reordered = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000010, lvl: 12, timer: 7200 },
        { data: 1000008, lvl: 20, timer: 3600 },
      ],
    },
    { now },
  );
  assert.equal(
    first.upgrades.find((item) => item.dataId === 1000008)?.id,
    reordered.upgrades.find((item) => item.dataId === 1000008)?.id,
  );
});

test("[IMPORT-DIFF-001] summarizes changed upgrades and available slots", () => {
  const previous = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000015, lvl: 6, cnt: 2 },
        { data: 1000007, lvl: 15 },
        { data: 1000008, lvl: 20, timer: 3600 },
      ],
      buildings2: [
        { data: 1000034, lvl: 10 },
        { data: 1000046, lvl: 10 },
      ],
    },
    { now },
  );
  const current = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp: timestamp + 60,
      buildings: [
        { data: 1000015, lvl: 6, cnt: 2 },
        { data: 1000007, lvl: 15 },
      ],
      heroes: [{ data: 28000001, lvl: 96, timer: 7200 }],
      buildings2: [
        { data: 1000034, lvl: 10 },
        { data: 1000046, lvl: 10 },
        { data: 1000044, lvl: 10, timer: 900 },
      ],
    },
    { now },
  );
  const diff = compareVillageExports(previous, current);
  assert.deepEqual(
    diff.started.map((item) => item.name),
    ["Archer Queen", "Cannon"],
  );
  assert.deepEqual(
    diff.ended.map((item) => item.name),
    ["Cannon"],
  );
  assert.deepEqual(
    diff.slots.map((item) => item.slot),
    ["builderBuilders"],
  );
  assert.deepEqual(compareVillageExports(null, current), { hasPrevious: false, started: [], ended: [], slots: [] });

  const legacyNormalized = {
    ...previous,
    upgrades: previous.upgrades.map((upgrade, index) => ({
      ...upgrade,
      id: `export:buildings:${upgrade.dataId}:${index}`,
    })),
  };
  assert.notDeepEqual(compareVillageExports(legacyNormalized, previous), {
    hasPrevious: true,
    started: [],
    ended: [],
    slots: [],
  });
  const reparsedStored = parseVillageExport(previous.raw, { allowHistorical: true });
  assert.deepEqual(compareVillageExports(reparsedStored, previous), {
    hasPrevious: true,
    started: [],
    ended: [],
    slots: [],
  });
});

test("[IMPORT-SLOT-001] reports unlocked idle upgrade slots as available", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000001, lvl: 17 },
        { data: 1000015, lvl: 6, cnt: 5 },
        { data: 1000007, lvl: 15 },
        { data: 1000068, lvl: 10 },
      ],
      buildings2: [
        { data: 1000034, lvl: 10 },
        { data: 1000046, lvl: 10 },
        { data: 1000078, lvl: 1 },
      ],
    },
    { now },
  );

  assert.deepEqual(result.builders, { total: 5, free: 5, regularTotal: 5 });
  assert.deepEqual(result.upgradeSlots, {
    laboratory: { available: true, active: 0, total: 1 },
    petHouse: { available: true },
    builderBase: { builders: { total: 2, free: 2 }, laboratory: { available: true, active: 0, total: 1 } },
  });
});

test("[IMPORT-SLOT-002] infers a Goblin Researcher slot from concurrent research timers", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000001, lvl: 17 },
        { data: 1000015, lvl: 6, cnt: 5 },
        { data: 1000007, lvl: 15 },
      ],
      units: [
        { data: 4000003, lvl: 9, timer: 600 },
        { data: 4000095, lvl: 3, timer: 1200 },
      ],
    },
    { now },
  );

  assert.deepEqual(result.upgradeSlots.laboratory, { available: false, active: 2, total: 2 });
});

test("[IMPORT-SLOT-003] infers the additional Builder Base builder from concurrent worker upgrades", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000001, lvl: 17 },
        { data: 1000015, lvl: 6, cnt: 5 },
      ],
      buildings2: [
        { data: 1000034, lvl: 10 },
        { data: 1000078, lvl: 9, timer: 600 },
        { data: 1000043, lvl: 9, timer: 1200 },
      ],
      heroes2: [{ data: 28000005, lvl: 26, timer: 1800 }],
    },
    { now },
  );

  assert.deepEqual(result.upgradeSlots.builderBase?.builders, { total: 3, free: 0 });
});

test("[IMPORT-SLOT-004] hides locked slots and treats facilities under upgrade as busy", () => {
  const result = parseVillageExport(
    {
      tag: "#2P0J8LQ",
      timestamp,
      buildings: [
        { data: 1000001, lvl: 10 },
        { data: 1000015, lvl: 5, cnt: 5 },
        { data: 1000007, lvl: 9, timer: 600 },
      ],
      buildings2: [
        { data: 1000034, lvl: 5 },
        { data: 1000078, lvl: 0 },
      ],
    },
    { now },
  );

  assert.deepEqual(result.upgradeSlots, {
    laboratory: { available: false, active: 0, total: 1 },
    petHouse: null,
    builderBase: { builders: { total: 1, free: 1 }, laboratory: null },
  });
});

test("[IMPORT-VALIDATION-001] rejects stale, future, and suspicious export values", () => {
  assert.throws(
    () => parseVillageExport({ tag: "#2P0J8LQ", timestamp: Math.floor(now / 1000) - 31 * 86400 }, { now }),
    /older than 30 days/,
  );
  assert.throws(
    () => parseVillageExport({ tag: "#2P0J8LQ", timestamp: Math.floor(now / 1000) + 700 }, { now }),
    /future/,
  );
  assert.throws(
    () =>
      parseVillageExport(
        { tag: "#2P0J8LQ", timestamp, buildings: [{ data: 1000008, lvl: 2, timer: 181 * 86400 }] },
        { now },
      ),
    /invalid timer/,
  );
});
