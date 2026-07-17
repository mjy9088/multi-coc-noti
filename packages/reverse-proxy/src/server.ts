import http from "node:http";
import net from "node:net";
import { upstreamFor } from "./routing.ts";

const port = Number(process.env.PORT || 3000);
const dashboard = new URL(process.env.DASHBOARD_UPSTREAM || "http://127.0.0.1:3001");
const collector = new URL(process.env.COLLECTOR_UPSTREAM || "http://127.0.0.1:8787");

function targetFor(rawUrl = "/"): URL {
  return new URL(upstreamFor(new URL(rawUrl, "http://gateway").pathname, dashboard.href, collector.href));
}

function forwardedHeaders(request: http.IncomingMessage): http.OutgoingHttpHeaders {
  const headers = { ...request.headers };
  delete headers.connection;
  delete headers.upgrade;
  headers["x-forwarded-host"] ||= request.headers.host;
  headers["x-forwarded-proto"] ||= "http";
  const address = request.socket.remoteAddress;
  if (address) headers["x-forwarded-for"] = headers["x-forwarded-for"] ? `${headers["x-forwarded-for"]}, ${address}` : address;
  return headers;
}

const server = http.createServer((request, response) => {
  const target = targetFor(request.url);
  const upstream = http.request({ hostname: target.hostname, port: target.port, method: request.method, path: request.url, headers: forwardedHeaders(request) }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Upstream unavailable: ${error.message}`);
  });
  request.pipe(upstream);
});

server.on("upgrade", (request, socket, head) => {
  const target = targetFor(request.url);
  const upstream = net.connect(Number(target.port || 80), target.hostname, () => {
    const headers = { ...forwardedHeaders(request), connection: "Upgrade", upgrade: request.headers.upgrade || "websocket" };
    const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`, ...Object.entries(headers).flatMap(([key, value]) => value == null ? [] : [`${key}: ${Array.isArray(value) ? value.join(", ") : value}`]), "", ""];
    upstream.write(lines.join("\r\n"));
    if (head.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
});

server.listen(port, "0.0.0.0", () => console.log(`Reverse proxy listening on :${port}; /api -> ${collector.href}, everything else -> ${dashboard.href}`));
