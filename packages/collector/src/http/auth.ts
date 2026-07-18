import { timingSafeEqual } from "node:crypto";

function equalSecret(a = "", b = ""): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAdminTokenAuthorized(authorization: string, adminToken: string): boolean {
  const bearer = authorization.replace(/^Bearer\s+/i, "");
  return equalSecret(bearer, adminToken);
}
