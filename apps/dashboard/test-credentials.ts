export type TestCredentialsConfig = { username: string; password: string };

export function testCredentialsConfig(
  env: Record<string, string | undefined> = process.env,
): TestCredentialsConfig | null {
  if (env.AUTH_TEST_CREDENTIALS_ENABLED !== "true") return null;
  const username = env.AUTH_TEST_USERNAME?.trim();
  const password = env.AUTH_TEST_PASSWORD;
  if (!username || !password) {
    throw new Error("AUTH_TEST_USERNAME and AUTH_TEST_PASSWORD are required when AUTH_TEST_CREDENTIALS_ENABLED=true");
  }
  return { username, password };
}
