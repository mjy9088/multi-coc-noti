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
    "ui-contracts/no-js-viewport-breakpoint": "error",
    "ui-contracts/no-magic-layout-threshold": "error",
    "ui-contracts/sticky-tabs-route-frame": "error",
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

test("feature code does not duplicate responsive width breakpoints", () => {
  const [message] = messages(`window.matchMedia("(max-width: 720px)").matches;`);
  assert.equal(message.ruleId, "ui-contracts/no-js-viewport-breakpoint");
  assert.match(message.message, /CSS\/container queries/);
  assert.deepEqual(messages(`window.matchMedia("(display-mode: standalone)").matches;`), []);
});

test("geometry comparisons use owner-provided measurements", () => {
  const [message] = messages(`section.getBoundingClientRect().top <= 150;`);
  assert.equal(message.ruleId, "ui-contracts/no-magic-layout-threshold");
  assert.match(message.message, /useStickyStack/);
  assert.deepEqual(messages(`section.getBoundingClientRect().top <= stickyStackHeight;`), []);
});

test("sticky tab routes use a shared internal-scroll frame", () => {
  const [message] = messages(`
    <main>
      <StickyStackItem order={1}><Tabs /></StickyStackItem>
      <section>Short route</section>
    </main>
  `);
  assert.equal(message.ruleId, "ui-contracts/sticky-tabs-route-frame");
  assert.match(message.message, /StickyRouteFrame.*internal route scrolling/);
  const [missingKey] = messages(`
    <main>
      <StickyStackItem order={1}><Tabs /></StickyStackItem>
      <StickyRouteFrame>Short route</StickyRouteFrame>
    </main>
  `);
  assert.equal(missingKey.ruleId, "ui-contracts/sticky-tabs-route-frame");
  assert.match(missingKey.message, /scrollKey.*destination/);
  assert.deepEqual(
    messages(`
      <main>
        <StickyStackItem order={1}><Tabs /></StickyStackItem>
        <StickyRouteFrame scrollKey={route}>Short route</StickyRouteFrame>
      </main>
    `),
    [],
  );
});
