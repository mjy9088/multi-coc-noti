import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { DueNotification } from "@multi-coc/database";
import type { NotifierConfig } from "../src/notifier.ts";
import { localizeNotification, runOnce } from "../src/notifier.ts";

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

test("[ALERT-DELIVERY-001] delivers claimed notifications and records Bark success", async (context) => {
  const requests: Array<{ url: string | undefined; body: { title: string; body: string } }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    requests.push({ url: request.url, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"code":200}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(
    () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  );
  const address = server.address() as AddressInfo;
  const config: NotifierConfig = {
    intervalMs: 10_000,
    barkBase: `http://127.0.0.1:${address.port}`,
    deviceKey: "test-device",
    locale: "en",
    group: "Test",
  };
  const sent: string[] = [];
  const failed: string[] = [];
  const result = await runOnce(config, {
    logger: { log() {}, error() {} },
    store: {
      claim: async () => [due],
      sent: async (id) => {
        sent.push(id);
      },
      failed: async (id) => {
        failed.push(id);
      },
    },
  });
  assert.deepEqual(result, { delivered: 1, failed: 0 });
  assert.deepEqual(sent, [due.id]);
  assert.deepEqual(failed, []);
  assert.equal(requests[0].url, "/test-device");
  assert.match(requests[0].body.body, /60 minute/);
});

test("[ALERT-DELIVERY-002] returns failed Bark deliveries to the DB queue", async () => {
  const failed: string[] = [];
  const config: NotifierConfig = {
    intervalMs: 10_000,
    barkBase: "https://example.invalid",
    deviceKey: "test",
    locale: "ko",
    group: "Test",
  };
  const result = await runOnce(config, {
    fetchImpl: async () => new Response("no", { status: 503 }),
    logger: { log() {}, error() {} },
    store: {
      claim: async () => [due],
      sent: async () => {},
      failed: async (id) => {
        failed.push(id);
      },
    },
  });
  assert.deepEqual(result, { delivered: 0, failed: 1 });
  assert.deepEqual(failed, [due.id]);
});
