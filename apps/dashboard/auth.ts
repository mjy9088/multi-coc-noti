import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  authAccounts,
  authSessions,
  authVerificationTokens,
  claimUnownedLegacyData,
  drizzleDatabase,
  users,
} from "@multi-coc/database/auth-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

const providers = [];
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) providers.push(GitHub);
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) providers.push(Google);

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(drizzleDatabase(), {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  providers,
  session: { strategy: "database" },
  trustHost: true,
  pages: { signIn: "/sign-in" },
  events: {
    createUser: async ({ user }) => {
      if (user.id) await claimUnownedLegacyData(user.id);
    },
  },
  callbacks: {
    authorized: ({ auth: session, request }) =>
      (process.env.NODE_ENV !== "production" && process.env.AUTH_E2E_BYPASS === "1") ||
      request.nextUrl.pathname === "/sign-in" ||
      request.nextUrl.pathname.startsWith("/api/auth/") ||
      Boolean(session),
    session: ({ session, user }) => ({ ...session, user: { ...session.user, id: user.id } }),
  },
});
