import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import uiContracts from "../../scripts/eslint-plugin-ui-contracts.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "ui-contracts": uiContracts },
    rules: {
      "ui-contracts/icon-button-label": "error",
      "ui-contracts/no-legacy-feedback": "error",
      "ui-contracts/no-noninteractive-click": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
