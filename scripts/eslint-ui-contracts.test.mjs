import assert from "node:assert/strict";
import test from "node:test";
import { Linter } from "eslint";
import uiContracts from "./eslint-plugin-ui-contracts.mjs";

const linter = new Linter();
const config = {
  files: ["**/*.jsx"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { "ui-contracts": uiContracts },
  rules: {
    "ui-contracts/icon-button-label": "error",
    "ui-contracts/no-legacy-feedback": "error",
    "ui-contracts/no-noninteractive-click": "error",
  },
};

function messages(source) {
  return linter.verify(source, config, "component.jsx");
}

test("non-interactive click handlers point authors to semantic components", () => {
  const [message] = messages(`<article onClick={open}>Village</article>`);
  assert.equal(message.ruleId, "ui-contracts/no-noninteractive-click");
  assert.match(message.message, /Button.*Link.*Dialog/);
  assert.deepEqual(messages(`<button onClick={save}>Save</button>`), []);
});

test("symbol-only buttons require an accessible label", () => {
  const [message] = messages(`<button type="button">×</button>`);
  assert.equal(message.ruleId, "ui-contracts/icon-button-label");
  assert.match(message.message, /IconButton/);
  assert.deepEqual(messages(`<button type="button" aria-label="Close">×</button>`), []);
});

test("feature-local feedback imports point authors to the shared toast system", () => {
  const [message] = messages(`import FeedbackToast from "./feedback-toast";`);
  assert.equal(message.ruleId, "ui-contracts/no-legacy-feedback");
  assert.match(message.message, /ToastProvider.*useToast/);
});
