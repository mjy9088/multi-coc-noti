import assert from "node:assert/strict";
import http from "node:http";
import { PassThrough } from "node:stream";
import test from "node:test";
import { bridgeSockets, createGateway } from "../src/gateway.ts";

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("server did not bind a TCP port"));
      resolve(address.port);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("[OPS-PROXY-002] absorbs WebSocket disconnect errors on either side of the tunnel", () => {
  for (const source of ["client", "upstream"] as const) {
    const client = new PassThrough();
    const upstream = new PassThrough();
    bridgeSockets(client, upstream);
    const error = Object.assign(new Error("disconnected"), { code: source === "client" ? "EPIPE" : "ECONNRESET" });
    assert.doesNotThrow(() => (source === "client" ? client : upstream).emit("error", error));
    assert.equal(client.destroyed, true);
    assert.equal(upstream.destroyed, true);
  }
});

test("[OPS-PROXY-002] keeps serving after an HTTP client aborts an upstream response", async () => {
  let releaseSlowResponse = () => {};
  const slowRequestStarted = new Promise<void>((resolve) => {
    releaseSlowResponse = resolve;
  });
  const upstream = http.createServer((request, response) => {
    if (request.url === "/slow") {
      releaseSlowResponse();
      setTimeout(() => response.end("late response"), 50).unref();
      return;
    }
    response.end("ok");
  });
  const upstreamPort = await listen(upstream);
  const target = new URL(`http://127.0.0.1:${upstreamPort}`);
  const gateway = createGateway({ dashboard: target, collector: target });
  const gatewayPort = await listen(gateway);
  try {
    const controller = new AbortController();
    const interrupted = fetch(`http://127.0.0.1:${gatewayPort}/slow`, { signal: controller.signal }).catch(
      (error) => error,
    );
    await slowRequestStarted;
    controller.abort();
    await interrupted;
    await new Promise((resolve) => setTimeout(resolve, 75));
    const response = await fetch(`http://127.0.0.1:${gatewayPort}/ok`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
  } finally {
    await close(gateway);
    await close(upstream);
  }
});
