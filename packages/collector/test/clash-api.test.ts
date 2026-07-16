import test from "node:test";
import assert from "node:assert/strict";
import { fetchPlayerProfile, mergeOfficialProfile } from "../src/clash-api.ts";

const account = { id: "account-uuid", playerTag: "#2ABC" };

test("fetches and maps an official player profile with an encoded tag", async () => {
  let request: { url: string; options?: RequestInit } | undefined;
  const profile = await fetchPlayerProfile(account, {
    env: { CLASH_OF_CLANS_API_TOKEN: "token", CLASH_OF_CLANS_API_BASE: "https://api.example/v1/" },
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({ name: "Real Village", tag: "#2ABC", townHallLevel: 17, expLevel: 241 }));
    },
  });
  assert.ok(request);
  assert.equal(request.url, "https://api.example/v1/players/%232ABC");
  assert.equal((request.options?.headers as Record<string, string>).Authorization, "Bearer token");
  assert.deepEqual(profile, { name: "Real Village", tag: "#2ABC", townHall: 17, level: 241 });
});

test("never makes an example snapshot look official", () => {
  const example = { name: "Example", dataSource: "example" };
  assert.equal(mergeOfficialProfile(example, { name: "Real" }), example);
  assert.equal(mergeOfficialProfile({ name: "Old", dataSource: "pull" }, { name: "Real" }).name, "Real");
});
