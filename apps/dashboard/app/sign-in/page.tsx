import { Button, InputField } from "@multi-coc/ui";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";
import { testCredentialsConfig } from "../../test-credentials";
import { signInWithTestCredentials } from "../../test-sign-in";

const providerNames = [
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET ? ["github", "GitHub"] : null,
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? ["google", "Google"] : null,
].filter((provider): provider is string[] => Boolean(provider));

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ testError?: string }> }) {
  if (await auth()) redirect("/");
  const testCredentials = testCredentialsConfig();
  const { testError } = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="app-brand-mark">M</div>
        <h1>Multi Village</h1>
        <p>Sign in to manage your villages and notification channels.</p>
        {providerNames.length ? (
          <div className="auth-provider-list">
            {providerNames.map(([id, name]) => (
              <form
                key={id}
                action={async () => {
                  "use server";
                  await signIn(id, { redirectTo: "/" });
                }}
              >
                <Button type="submit">Continue with {name}</Button>
              </form>
            ))}
          </div>
        ) : !testCredentials ? (
          <p role="alert">No social login provider is configured.</p>
        ) : null}
        {testCredentials && (
          <form className="auth-test-form" action={signInWithTestCredentials}>
            <p>Local test login</p>
            {testError === "invalid" && <p role="alert">The test username or password is incorrect.</p>}
            <InputField label="Username" name="username" autoComplete="username" required />
            <InputField label="Password" name="password" type="password" autoComplete="current-password" required />
            <Button type="submit">Sign in for testing</Button>
          </form>
        )}
      </section>
    </main>
  );
}
