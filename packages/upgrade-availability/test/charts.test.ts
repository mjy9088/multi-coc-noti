import test from "node:test";
import assert from "node:assert/strict";
import { buildUpgradeChartData } from "../index.ts";

test("[DISPLAY-CHART-001] charts home and combined upgrade capacity over completion time", () => {
  const now = new Date("2026-07-17T00:00:00Z").getTime();
  const result = buildUpgradeChartData([
    { base: "home", finishAt: "2026-07-17T01:00:00Z" },
    { base: "builder", finishAt: "2026-07-17T02:00:00Z" },
    { base: "home", finishAt: "2026-07-17T03:00:00Z" },
  ], 2, 1, now, 3);
  assert.deepEqual(result.timeline.map(({ activeHome, activeAll, availableHome, availableAll }) => ({ activeHome, activeAll, availableHome, availableAll })), [
    { activeHome: 2, activeAll: 3, availableHome: 2, availableAll: 3 },
    { activeHome: 1, activeAll: 2, availableHome: 3, availableAll: 4 },
    { activeHome: 1, activeAll: 1, availableHome: 3, availableAll: 5 },
    { activeHome: 0, activeAll: 0, availableHome: 4, availableAll: 6 },
  ]);
  assert.deepEqual(result.bins.map(({ home, all }) => ({ home, all })), [{ home: 1, all: 1 }, { home: 0, all: 1 }, { home: 1, all: 1 }]);
});
