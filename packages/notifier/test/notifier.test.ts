import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { appendJsonl } from "../../shared/snapshot.ts";
import { runOnce } from "../src/notifier.ts";
import type { NotifierConfig } from "../src/notifier.ts";

test("delivers each Bark event once across repeated runs", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "multi-coc-notifier-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const requests: Array<{ url: string | undefined; body: { title: string; body: string } }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    requests.push({ url: request.url, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"code":200}');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address() as AddressInfo;
  const eventDir = path.join(root, "events");
  const eventFile = path.join(eventDir, "2026-07-17.jsonl");
  const stateFile = path.join(root, "state.json");
  await appendJsonl(eventFile, {
    id: "1:upgrade:queen-97:2026-07-17T10:00:00Z",
    type: "upgrade.completed",
    accountId: "account-uuid",
    accountName: "Main",
    occurredAt: "2026-07-17T10:00:00Z",
    title: "Main 업그레이드 완료",
    body: "Archer Queen 레벨 97 완료",
    data: { upgrade: { id: "queen-97", name: "Archer Queen", type: "hero", level: 96, nextLevel: 97, finishAt: "2026-07-17T10:00:00Z" } },
  });
  const config: NotifierConfig = {
    eventFile: null,
    eventDir,
    stateFile,
    intervalMs: 10_000,
    barkBase: `http://127.0.0.1:${address.port}`,
    deviceKey: "test-device",
    locale: "en",
    group: "Test Group",
  };
  const logger = { log() {} };
  assert.deepEqual(await runOnce(config, { logger }), { delivered: 1, known: 1 });
  assert.deepEqual(await runOnce(config, { logger }), { delivered: 0, known: 1 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/test-device");
  assert.equal(requests[0].body.title, "Main upgrade complete");
  assert.match(requests[0].body.body, /level 97/);
});
