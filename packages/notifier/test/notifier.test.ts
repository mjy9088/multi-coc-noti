import assert from "node:assert/strict";
import test from "node:test";
import type { DueChannelDelivery, DueNotification } from "@multi-coc/database";
import { buildBarkPayload, localizeNotification, runOnce } from "../src/notifier.ts";

const due: DueNotification = {
  id: "notification-1",
  upgradeId: "upgrade-1",
  kind: "resource_preparation",
  minutesBefore: 60,
  preparationMinutes: 60,
  minutesRemaining: 60,
  accountName: "Main",
  upgradeName: "Archer Queen",
  nextLevel: 97,
  finishAt: "2026-07-17T10:00:00Z",
};

test("[ALERT-COPY-001] formats reminder and completion notifications", () => {
  assert.match(localizeNotification(due, "ko").title, /자원을 미리 준비하세요/);
  assert.match(localizeNotification({ ...due, kind: "completion", minutesBefore: 0 }, "en").title, /complete/);
  assert.match(
    localizeNotification({ ...due, kind: "refresh_required", minutesBefore: 0 }, "en").title,
    /update required/,
  );
});

test("[ALERT-BARK-001] resolves kind-specific Bark presentation and omits inapplicable parameters", () => {
  const passive = buildBarkPayload(due, {
    locale: "en",
    group: "Default group",
    deliveryRules: {
      resource_preparation: {
        sound: "glass",
        interruptionLevel: "passive",
        criticalVolume: 9,
        archive: false,
        archiveTtlSeconds: 3600,
        targetUrl: "https://coc.example.com/villages/main",
      },
    },
  });
  assert.deepEqual(passive, {
    title: "Main: prepare resources",
    body: "Prepare resources now. Archer Queen level 97 completes in about 60 minute(s).",
    level: "passive",
    group: "Default group",
    sound: "glass",
    url: "https://coc.example.com/villages/main",
    isArchive: "0",
  });

  const critical = buildBarkPayload(
    { ...due, kind: "completion" },
    {
      locale: "ko",
      group: "Default group",
      icon: "https://coc.example.com/icon.png",
      deliveryRules: {
        completion: {
          interruptionLevel: "critical",
          criticalVolume: 7,
          repeatSound: true,
          archive: true,
          archiveTtlSeconds: 86_400,
        },
      },
    },
  );
  assert.equal(critical?.sound, "minuet");
  assert.equal(critical?.volume, 7);
  assert.equal(critical?.call, "1");
  assert.equal(critical?.isArchive, "1");
  assert.equal(critical?.ttl, 86_400);

  assert.equal(
    buildBarkPayload(due, {
      locale: "en",
      group: "Default group",
      deliveryRules: { resource_preparation: { enabled: false } },
    }),
    null,
  );
});

test("[ALERT-DELIVERY-001] delivers managed channels and records channel-specific success", async () => {
  const managed: DueChannelDelivery = {
    ...due,
    deliveryId: "delivery-1",
    channel: {
      id: "channel-1",
      baseUrl: "https://managed-bark.example",
      deviceKey: "managed-device",
      defaultGroup: "Managed group",
      iconUrl: "https://coc.example/icon.png",
      locale: "en",
    },
    rule: {
      enabled: true,
      sound: "glass",
      interruptionLevel: "timeSensitive",
      criticalVolume: null,
      repeatSound: false,
      groupName: null,
      targetUrl: "https://coc.example/villages/main",
      archive: true,
      archiveTtlSeconds: 3600,
    },
  };
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const channelSent: string[] = [];
  const result = await runOnce({
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response("ok");
    },
    logger: { log() {}, error() {} },
    store: {
      claimChannels: async () => [managed],
      channelSent: async (id) => {
        channelSent.push(id);
      },
      channelFailed: async () => {},
    },
  });
  assert.deepEqual(result, { delivered: 1, failed: 0 });
  assert.deepEqual(channelSent, [managed.deliveryId]);
  assert.equal(requests[0].url, "https://managed-bark.example/managed-device");
  assert.equal(requests[0].body.group, "Managed group");
  assert.equal(requests[0].body.sound, "glass");
  assert.equal(requests[0].body.level, "timeSensitive");
});

test("[ALERT-DELIVERY-002] returns failed Bark deliveries to the DB queue", async () => {
  const failed: string[] = [];
  const managed: DueChannelDelivery = {
    ...due,
    deliveryId: "delivery-2",
    channel: {
      id: "channel-2",
      baseUrl: "https://example.invalid",
      deviceKey: "test",
      defaultGroup: "Test",
      iconUrl: null,
      locale: "ko",
    },
    rule: {
      enabled: true,
      sound: null,
      interruptionLevel: "active",
      criticalVolume: null,
      repeatSound: false,
      groupName: null,
      targetUrl: null,
      archive: null,
      archiveTtlSeconds: null,
    },
  };
  const result = await runOnce({
    fetchImpl: async () => new Response("no", { status: 503 }),
    logger: { log() {}, error() {} },
    store: {
      claimChannels: async () => [managed],
      channelSent: async () => {},
      channelFailed: async (id) => {
        failed.push(id);
      },
    },
  });
  assert.deepEqual(result, { delivered: 0, failed: 1 });
  assert.deepEqual(failed, [managed.deliveryId]);
});
