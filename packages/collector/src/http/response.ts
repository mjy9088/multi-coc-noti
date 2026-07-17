import type { ServerResponse } from "node:http";

export type ResponseHeaders = Record<string, string>;

export function json(response: ServerResponse, status: number, value: unknown, headers: ResponseHeaders = {}): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(value));
}
