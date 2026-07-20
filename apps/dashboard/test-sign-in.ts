"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createLocalTestSession, localTestUserId } from "@multi-coc/database/auth-adapter";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { testCredentialsConfig } from "./test-credentials";

const sessionMaxAgeSeconds = 30 * 24 * 60 * 60;

function equalSecret(left: string, right: string): boolean {
  return timingSafeEqual(createHash("sha256").update(left).digest(), createHash("sha256").update(right).digest());
}

export async function signInWithTestCredentials(formData: FormData): Promise<void> {
  const configured = testCredentialsConfig();
  if (!configured) redirect("/sign-in");
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!equalSecret(username, configured.username) || !equalSecret(password, configured.password)) {
    redirect("/sign-in?testError=invalid");
  }

  const userId = localTestUserId(configured.username);
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionMaxAgeSeconds * 1_000);
  await createLocalTestSession({ userId, username: configured.username, sessionToken, expires });

  const requestHeaders = await headers();
  const secure =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
    requestHeaders.get("origin")?.startsWith("https://") === true;
  const cookieStore = await cookies();
  cookieStore.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
  redirect("/");
}
