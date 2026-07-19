import assert from "node:assert/strict";
import test from "node:test";
import { upstreamFor } from "../src/routing.ts";

test("[OPS-PROXY-001] separates Auth.js, application API, health, and Dashboard paths", () => {
  assert.equal(upstreamFor("/api", "dashboard", "collector"), "collector");
  assert.equal(upstreamFor("/api/dashboard", "dashboard", "collector"), "collector");
  assert.equal(upstreamFor("/api/auth/session", "dashboard", "collector"), "dashboard");
  assert.equal(upstreamFor("/health", "dashboard", "collector"), "collector");
  assert.equal(upstreamFor("/apiary", "dashboard", "collector"), "dashboard");
  assert.equal(upstreamFor("/_next/webpack-hmr", "dashboard", "collector"), "dashboard");
  assert.equal(upstreamFor("/sw.js", "dashboard", "collector"), "dashboard");
});
