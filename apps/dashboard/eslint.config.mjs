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
      "ui-contracts/no-js-viewport-breakpoint": "error",
      "ui-contracts/no-magic-layout-threshold": "error",
      "ui-contracts/no-shared-composition-classname": "error",
      "ui-contracts/sticky-tabs-route-frame": "error",
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "ui-contracts/no-shared-composition-classname": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../app/**", "../../app/**", "../../../app/**"],
              message:
                "Dashboard components must not import from the App Router assembly layer. Move shared product code under components, or pass route-owned state through props.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "ui-contracts/no-magic-layout-threshold": "off",
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
