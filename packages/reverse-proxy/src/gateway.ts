import http from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import { upstreamFor } from "./routing.ts";

export type GatewayOptions = {
  dashboard: URL;
  collector: URL;
};

const disconnectCodes = new Set(["ECONNABORTED", "ECONNRESET", "EPIPE", "ERR_STREAM_PREMATURE_CLOSE"]);

function isDisconnectError(error: unknown): boolean {
  return disconnectCodes.has((error as NodeJS.ErrnoException | undefined)?.code || "");
}

function targetFor(rawUrl: string | undefined, { dashboard, collector }: GatewayOptions): URL {
  return new URL(upstreamFor(new URL(rawUrl || "/", "http://gateway").pathname, dashboard.href, collector.href));
}

function forwardedHeaders(request: http.IncomingMessage): http.OutgoingHttpHeaders {
  const headers = { ...request.headers };
  delete headers.connection;
  delete headers.upgrade;
  headers["x-forwarded-host"] ||= request.headers.host;
  headers["x-forwarded-proto"] ||= "http";
  const address = request.socket.remoteAddress;
  if (address)
    headers["x-forwarded-for"] = headers["x-forwarded-for"] ? `${headers["x-forwarded-for"]}, ${address}` : address;
  return headers;
}

function destroy(stream: { destroyed: boolean; destroy(error?: Error): unknown }): void {
  if (!stream.destroyed) stream.destroy();
}

export function bridgeSockets(client: Duplex, upstream: Duplex): void {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    destroy(client);
    destroy(upstream);
  };
  client.on("error", close);
  upstream.on("error", close);
  client.on("close", close);
  upstream.on("close", close);
  client.pipe(upstream);
  upstream.pipe(client);
}

export function createGateway(options: GatewayOptions): http.Server {
  const server = http.createServer((request, response) => {
    const target = targetFor(request.url, options);
    let upstreamResponse: http.IncomingMessage | undefined;
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        method: request.method,
        path: request.url,
        headers: forwardedHeaders(request),
      },
      (incoming) => {
        upstreamResponse = incoming;
        if (response.destroyed) return incoming.destroy();
        response.writeHead(incoming.statusCode || 502, incoming.headers);
        incoming.on("error", (error) => {
          if (!isDisconnectError(error)) response.destroy(error as Error);
          else response.destroy();
        });
        incoming.pipe(response);
      },
    );

    const closeUpstream = () => {
      destroy(upstream);
      if (upstreamResponse) destroy(upstreamResponse);
    };
    request.on("aborted", closeUpstream);
    request.on("error", closeUpstream);
    response.on("close", closeUpstream);
    response.on("error", closeUpstream);
    upstream.on("error", (error) => {
      if (response.destroyed) return;
      if (isDisconnectError(error)) return response.destroy();
      if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Upstream unavailable: ${error.message}`);
    });
    request.pipe(upstream);
  });

  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("upgrade", (request, socket, head) => {
    const target = targetFor(request.url, options);
    const upstream = net.connect(Number(target.port || 80), target.hostname, () => {
      const headers = {
        ...forwardedHeaders(request),
        connection: "Upgrade",
        upgrade: request.headers.upgrade || "websocket",
      };
      const lines = [
        `${request.method} ${request.url} HTTP/${request.httpVersion}`,
        ...Object.entries(headers).flatMap(([key, value]) =>
          value == null ? [] : [`${key}: ${Array.isArray(value) ? value.join(", ") : value}`],
        ),
        "",
        "",
      ];
      upstream.write(lines.join("\r\n"));
      if (head.length) upstream.write(head);
      bridgeSockets(socket, upstream);
    });
    // Connection failures can happen before bridgeSockets installs the shared handler.
    upstream.once("error", () => {
      destroy(socket);
      destroy(upstream);
    });
    socket.once("error", () => {
      destroy(socket);
      destroy(upstream);
    });
    socket.once("close", () => destroy(upstream));
  });
  return server;
}
