import type { IncomingMessage } from "node:http";

export type RequestValue = Record<string, unknown>;

async function body(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 2_000_000) throw new Error("payload too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function requestJson(request: IncomingMessage): Promise<RequestValue> {
  const text = await body(request);
  return text ? (JSON.parse(text) as RequestValue) : {};
}
