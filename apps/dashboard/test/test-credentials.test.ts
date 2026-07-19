import assert from "node:assert/strict";
import test from "node:test";
import { testCredentialsConfig } from "../test-credentials.ts";

test("[AUTH-TEST-001] test credentials stay unavailable unless explicitly enabled with complete credentials", () => {
  assert.equal(testCredentialsConfig({}), null);
  assert.equal(
    testCredentialsConfig({
      AUTH_TEST_CREDENTIALS_ENABLED: "false",
      AUTH_TEST_USERNAME: "tester",
      AUTH_TEST_PASSWORD: "pw",
    }),
    null,
  );
  assert.throws(() => testCredentialsConfig({ AUTH_TEST_CREDENTIALS_ENABLED: "true" }), /are required/);
  assert.deepEqual(
    testCredentialsConfig({
      AUTH_TEST_CREDENTIALS_ENABLED: "true",
      AUTH_TEST_USERNAME: " tester ",
      AUTH_TEST_PASSWORD: "secret",
    }),
    { username: "tester", password: "secret" },
  );
});
