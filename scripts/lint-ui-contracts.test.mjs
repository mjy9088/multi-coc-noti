import assert from "node:assert/strict";
import test from "node:test";
import { lintCss } from "./lint-ui-contracts.mjs";

// Implementation tests for the repository linter; these do not represent product behavior contracts.
test("bottom sheets explain how to remove an accidental outer gap", () => {
  const [diagnostic] = lintCss(`.mobile-sheet { position: absolute; border-radius: 1rem 1rem 0 0; }`);
  assert.equal(diagnostic.ruleId, "bottom-sheet-edge");
  assert.match(diagnostic.message, /bottom: 0/);
});

test("bottom sheets reject an outer bottom margin", () => {
  const [diagnostic] = lintCss(`
    .mobile-sheet {
      position: absolute;
      bottom: 0;
      margin-bottom: 1rem;
      border-radius: 1rem 1rem 0 0;
    }
  `);
  assert.equal(diagnostic.ruleId, "bottom-sheet-margin");
  assert.match(diagnostic.message, /safe-area padding/);
});

test("bottom-sticky action rows direct authors to ActionBar", () => {
  const diagnostics = lintCss(`.save-actions { position: sticky; bottom: 0; background: white; }`);
  assert.equal(diagnostics[0].ruleId, "sticky-action-component");
  assert.match(diagnostics[0].message, /ActionBar sticky/);
});

test("feature layout may reposition the owned sticky ActionBar responsively", () => {
  const diagnostics = lintCss(`
    .feature-actions.ui-action-bar-sticky {
      --ui-surface-context: var(--ui-color-surface);
      position: sticky;
      bottom: 0;
      background: var(--ui-color-surface);
    }
  `);
  assert.deepEqual(diagnostics, []);
});

test("sticky regions explain the shared surface strategy", () => {
  const [diagnostic] = lintCss(`.filters { position: sticky; top: 0; background: transparent; }`);
  assert.equal(diagnostic.ruleId, "sticky-surface");
  assert.match(diagnostic.message, /ui-sticky-surface/);
});

test("stacked sticky navigation uses one semantic offset", () => {
  const [diagnostic] = lintCss(`
    .route-tabs {
      position: sticky;
      top: calc(var(--app-header-height) + 1rem);
      background: var(--ui-color-surface);
    }
  `);
  assert.equal(diagnostic.ruleId, "sticky-stack-offset");
  assert.match(diagnostic.message, /fully visible/);
  assert.deepEqual(
    lintCss(`
      .route-tabs {
        --ui-surface-context: var(--ui-color-surface);
        position: sticky;
        top: var(--app-sticky-route-offset);
        background: var(--ui-color-surface);
      }
    `),
    [],
  );
});

test("viewport content uses the measured sticky stack height", () => {
  const [diagnostic] = lintCss(
    `.feature-pane { height: calc(100dvh - var(--app-shell-height) - 3rem); }`,
    "apps/dashboard/app/feature.css",
  );
  assert.equal(diagnostic.ruleId, "viewport-stack-height");
  assert.match(diagnostic.message, /StickyStackProvider/);
  assert.deepEqual(
    lintCss(
      `.feature-pane { height: calc(var(--ui-viewport-available-height) - var(--ui-space-4)); }`,
      "apps/dashboard/app/feature.css",
    ),
    [],
  );
});

test("sticky viewport panes use the shared composition", () => {
  const [diagnostic] = lintCss(
    `
      .feature-layout {
        position: sticky;
        top: var(--feature-sticky-content-offset);
        height: var(--ui-viewport-available-height);
        background: var(--ui-color-canvas);
      }
    `,
    "apps/dashboard/app/feature.css",
  );
  assert.equal(diagnostic.ruleId, "sticky-viewport-component");
  assert.match(diagnostic.message, /StickyStackViewport/);
});

test("sticky viewport gaps describe both block edges", () => {
  const [diagnostic] = lintCss(`.feature-layout { --ui-sticky-viewport-block-start-gap: 1rem; }`);
  assert.equal(diagnostic.ruleId, "sticky-viewport-gap-pair");
  assert.match(diagnostic.message, /block-end-gap/);
  assert.deepEqual(
    lintCss(`
      .feature-layout {
        --ui-sticky-viewport-block-start-gap: 1rem;
        --ui-sticky-viewport-block-end-gap: 1rem;
      }
    `),
    [],
  );
});

test("bleed variables remain paired", () => {
  const [diagnostic] = lintCss(`.pane { --ui-sticky-surface-inline-bleed: 1rem; }`);
  assert.equal(diagnostic.ruleId, "sticky-bleed-pair");
});

test("multi-pane layouts direct authors to SplitLayout", () => {
  const [diagnostic] = lintCss(`
    .settings-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  `);
  assert.equal(diagnostic.ruleId, "split-layout-component");
  assert.match(diagnostic.message, /SplitLayout/);
});

test("shared solutions satisfy all UI contracts", () => {
  const diagnostics = lintCss(
    `
      .ui-sticky-surface { position: sticky; top: 0; }
      .mobile-sheet {
        position: absolute;
        bottom: 0;
        border-radius: var(--ui-radius-large) var(--ui-radius-large) 0 0;
      }
      .pane {
        --ui-sticky-surface-inline-bleed: 1rem;
        --ui-sticky-surface-block-end-bleed: 1rem;
      }
    `,
    "packages/ui/src/styles/components.css",
  );
  assert.deepEqual(diagnostics, []);
});

test("a suppression requires a rule id and a specific reason", () => {
  const suppressed = lintCss(`
    /* ui-contract-disable-next-line sticky-surface -- translucent app chrome is intentional */
    .app-header { position: sticky; top: 0; }
  `);
  const missingReason = lintCss(`
    /* ui-contract-disable-next-line sticky-surface */
    .app-header { position: sticky; top: 0; }
  `);
  assert.deepEqual(suppressed, []);
  assert.equal(missingReason[0].ruleId, "sticky-surface");
});

test("mobile form controls reject auto-zooming font sizes", () => {
  const diagnostics = [
    lintCss(`input[type="text"] { font-size: 0.875rem; }`)[0],
    lintCss(`textarea { font: 500 14px/1.4 sans-serif; }`)[0],
  ];
  assert.ok(diagnostics.every((diagnostic) => diagnostic.ruleId === "mobile-form-font-size"));
  assert.match(diagnostics[0].message, /1rem/);
});

test("stacking values use semantic layer tokens", () => {
  const [diagnostic] = lintCss(`.header { z-index: 999; }`);
  assert.equal(diagnostic.ruleId, "z-index-token");
  assert.match(diagnostic.message, /--ui-layer-/);
});

test("raw colors, radii, and shadows point to design tokens", () => {
  const diagnostics = lintCss(`
    .custom-card {
      color: #123456;
      border-radius: 7px;
      box-shadow: 0 2px 8px #0003;
    }
  `);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.ruleId),
    ["design-token-color", "design-token-radius", "design-token-shadow"],
  );
});

test("feature overlays point to the owned Dialog primitive", () => {
  const [diagnostic] = lintCss(
    `.feature-backdrop { position: fixed; inset: 0; background: var(--ui-color-overlay); }`,
    "apps/dashboard/app/feature.css",
  );
  assert.equal(diagnostic.ruleId, "overlay-component");
  assert.match(diagnostic.message, /Dialog/);
});

test("surface containers publish their context to nested sticky regions", () => {
  const [diagnostic] = lintCss(`.card { background: var(--ui-color-surface); }`);
  assert.equal(diagnostic.ruleId, "surface-context");
  assert.match(diagnostic.message, /--ui-surface-context/);
});

test("scroll containers opt out of intrinsic minimum sizing", () => {
  const diagnostics = lintCss(`
    .tabs { overflow-x: auto; }
    .pane { overflow-y: scroll; }
  `);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.ruleId),
    ["scroll-container-size", "scroll-container-size"],
  );
  assert.match(diagnostics[0].message, /min-width: 0/);
});
