import { authenticateSessionToken } from "@multi-coc/database";
import type { Context } from "hono";

function cookies(header: string): Map<string, string> {
  return new Map(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => Boolean(name && value))
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))]),
  );
}

export function sessionTokenFromCookie(header: string): string | null {
  const values = cookies(header);
  for (const base of ["__Secure-authjs.session-token", "authjs.session-token"]) {
    const direct = values.get(base);
    if (direct) return direct;
    const chunks = [...values.entries()]
      .filter(([name]) => name.startsWith(`${base}.`))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
    if (chunks.length) return chunks.join("");
  }
  return null;
}

export async function authenticatedUser(c: Context) {
  const token = sessionTokenFromCookie(c.req.header("cookie") || "");
  return token ? authenticateSessionToken(token) : null;
}

export function requestUserId(c: Context): string {
  return String(c.get("userId" as never));
}
