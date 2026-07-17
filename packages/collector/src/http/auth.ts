import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

function equalSecret(a = "", b = ""): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAdminAuthorized(request: IncomingMessage, adminToken: string): boolean {
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  return equalSecret(bearer, adminToken);
}
