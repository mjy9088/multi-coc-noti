import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import uiContracts from "../../scripts/eslint-plugin-ui-contracts.mjs";

const eslintConfig = defineConfig([
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
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
