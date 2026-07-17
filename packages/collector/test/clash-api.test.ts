import assert from "node:assert/strict";
import test from "node:test";
import { fetchPlayerProfile, mergeOfficialProfile } from "../src/clash-api.ts";

const account = { id: "account-uuid", playerTag: "#2ABC" };

test("[API-PROFILE-001] fetches and maps an official player profile with an encoded tag", async () => {
  let request: { url: string; options?: RequestInit } | undefined;
  const profile = await fetchPlayerProfile(account, {
    env: { CLASH_OF_CLANS_API_TOKEN: "token", CLASH_OF_CLANS_API_BASE: "https://api.example/v1/" },
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(
        JSON.stringify({
          name: "Real Village",
          tag: "#2ABC",
          townHallLevel: 17,
          expLevel: 241,
          trophies: 5100,
          bestTrophies: 5300,
          league: { name: "Legend League" },
          warStars: 1200,
          donations: 500,
          donationsReceived: 300,
          clanCapitalContributions: 42000,
        }),
      );
    },
  });
  assert.ok(request);
  assert.equal(request.url, "https://api.example/v1/players/%232ABC");
  assert.ok(request.options);
  assert.equal((request.options.headers as Record<string, string>).Authorization, "Bearer token");
  assert.deepEqual(profile, {
    name: "Real Village",
    tag: "#2ABC",
    townHall: 17,
    level: 241,
    stats: {
      trophies: 5100,
      bestTrophies: 5300,
      league: "Legend League",
      warStars: 1200,
      donations: 500,
      donationsReceived: 300,
      capitalContributions: 42000,
    },
  });
});

test("[API-PROFILE-002] preserves the example origin when merging an official profile", () => {
  const example = { name: "Example", dataSource: "example" };
  assert.equal(mergeOfficialProfile(example, { name: "Real" }), example);
});

test("[API-PROFILE-003] preserves the configured display name during official profile enrichment", () => {
  assert.equal(
    mergeOfficialProfile({ name: "Display Name", dataSource: "game-export" }, { name: "Game Name" }).name,
    "Display Name",
  );
});
