import test from "node:test";
import assert from "node:assert/strict";
import { applyDisplayOptions, defaultDisplayOptions, matchesAvailabilityFilter, observeAvailability, summarizeAvailability } from "../index.ts";

test("[DISPLAY-SLOT-001] observes Goblin helpers from concurrent work", () => {
  const observations = observeAvailability([
    { builders: { free: 0, total: 7, regularTotal: 6 }, upgradeSlots: { laboratory: { available: false, active: 2, total: 2 } } },
  ]);
  assert.deepEqual(observations, { goblinResearcher: true, goblinBuilder: true });
});

test("[DISPLAY-SLOT-002] offers a second research slot when one account proves the event is active", () => {
  const result = applyDisplayOptions(
    { builders: { free: 0, total: 6, regularTotal: 6 }, upgradeSlots: { laboratory: { available: false, active: 1, total: 1 } } },
    { goblinResearcher: true, goblinBuilder: false },
    defaultDisplayOptions,
  );
  assert.deepEqual(result.laboratory, { available: true, active: 1, total: 2 });
});

test("[DISPLAY-SLOT-003] offers a Goblin Builder only after all eligible regular builders are busy", () => {
  const observations = { goblinResearcher: false, goblinBuilder: true };
  const busy = applyDisplayOptions({ builders: { free: 0, total: 6, regularTotal: 6 } }, observations, defaultDisplayOptions);
  const partiallyFree = applyDisplayOptions({ builders: { free: 1, total: 6, regularTotal: 6 } }, observations, defaultDisplayOptions);
  const ineligible = applyDisplayOptions({ builders: { free: 0, total: 4, regularTotal: 4 } }, observations, defaultDisplayOptions);

  assert.deepEqual(busy.builders, { free: 1, total: 7, regularTotal: 6 });
  assert.deepEqual(partiallyFree.builders, { free: 1, total: 6, regularTotal: 6 });
  assert.deepEqual(ineligible.builders, { free: 0, total: 4, regularTotal: 4 });
});

test("[DISPLAY-SLOT-004] respects disabled inference options", () => {
  const account = { builders: { free: 0, total: 6, regularTotal: 6 }, upgradeSlots: { laboratory: { available: false, active: 1, total: 1 } } };
  const result = applyDisplayOptions(account, { goblinResearcher: true, goblinBuilder: true }, { goblinResearcher: false, goblinBuilder: false });
  assert.equal(result.builders, account.builders);
  assert.equal(result.laboratory, account.upgradeSlots.laboratory);
});

test("[DISPLAY-SUMMARY-001] totals idle Home Village and Builder Base slots separately", () => {
  const accounts = [
    {
      builders: { free: 1, total: 6 },
      upgradeSlots: {
        laboratory: { available: true }, petHouse: { available: false },
        builderBase: { builders: { free: 1, total: 2 }, laboratory: { available: true } },
      },
    },
    {
      builders: { free: 2, total: 5 },
      upgradeSlots: { laboratory: { available: false }, petHouse: { available: true }, builderBase: null },
    },
  ];
  assert.deepEqual(summarizeAvailability(accounts, { goblinResearcher: false, goblinBuilder: false }, defaultDisplayOptions), {
    homeVillage: 5, builderBase: 2,
  });
});

test("[DISPLAY-FILTER-001] distinguishes Home Village availability from any available slot", () => {
  const account = { builders: { free: 0, total: 6 }, upgradeSlots: { laboratory: { available: false }, petHouse: null, builderBase: { builders: { free: 1, total: 2 }, laboratory: null } } };
  const observations = { goblinResearcher: false, goblinBuilder: false };
  assert.equal(matchesAvailabilityFilter(account, "home", observations, defaultDisplayOptions), false);
  assert.equal(matchesAvailabilityFilter(account, "any", observations, defaultDisplayOptions), true);
});
