import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postcss from "postcss";

const root = fileURLToPath(new URL("..", import.meta.url));
const ignoredFiles = new Set(["apps/dashboard/app/styles/legacy.css"]);

const messages = {
  "bottom-sheet-edge":
    "A top-corner-only sheet must sit flush against its lower containing edge. Add `bottom: 0` and keep safe-area spacing inside ActionBar or the sheet content.",
  "bottom-sheet-margin":
    "A bottom sheet cannot have an outer bottom margin. Remove it; use internal safe-area padding on ActionBar instead.",
  "sticky-action-component":
    "Do not hand-roll a bottom-sticky action row. Use `ActionBar sticky` so surface color, bleed, safe area, and stacking stay consistent.",
  "sticky-surface":
    "A sticky region needs an explicit surface strategy. Add `ui-sticky-surface` and inherit `--ui-surface-context`, or declare an intentional non-transparent background.",
  "sticky-stack-offset":
    "A non-zero sticky top must use one semantic `--*-sticky-*-offset` variable. Define the complete stack offset beside its owning shell so navigation is fully visible instead of partially covered.",
  "viewport-stack-height":
    "Do not subtract shell or sticky heights from 100dvh manually. Register sticky chrome with StickyStackProvider/StickyStackItem and size content from `--ui-viewport-available-height`.",
  "sticky-viewport-component":
    "Do not hand-roll a sticky viewport-bounded pane. Use StickyStackViewport so its cumulative top offset and available height cannot drift apart.",
  "sticky-viewport-gap-pair":
    "A sticky viewport inset must define both `--ui-sticky-viewport-block-start-gap` and `--ui-sticky-viewport-block-end-gap`. This keeps the pane from accidentally touching one viewport edge.",
  "sticky-bleed-pair":
    "Sticky surface bleed must describe both axes. Define `--ui-sticky-surface-inline-bleed` and `--ui-sticky-surface-block-end-bleed` together.",
  "split-layout-component":
    "Do not top-align a multi-pane layout and let pane heights diverge. Render it with `SplitLayout`; feature CSS should only own columns, gap, collapse, and overflow.",
  "mobile-form-font-size":
    "Form controls below 1rem can trigger browser auto-zoom on mobile. Use at least `font-size: 1rem` on input, select, textarea, and `.ui-input` controls.",
  "z-index-token":
    "Raw z-index values make stacking contexts drift. Use the nearest `--ui-layer-*` token, or add a semantic layer token in packages/ui/src/styles/tokens.css.",
  "design-token-color":
    "Do not introduce a raw color in owned CSS. Reuse a `--ui-color-*` token or add a semantic token in packages/ui/src/styles/tokens.css.",
  "design-token-radius":
    "Do not introduce an arbitrary corner radius. Use a `--ui-radius-*` token; `0`, `50%`, and `999px` remain available for edges, circles, and pills.",
  "design-token-shadow":
    "Do not introduce a raw box shadow. Reuse a `--ui-shadow-*` token or define a semantic shadow token in packages/ui/src/styles/tokens.css.",
  "overlay-component":
    "Do not build a feature-local full-screen overlay or bottom sheet. Compose the owned `Dialog` primitive so focus, Escape, scroll locking, safe areas, and stacking remain correct.",
  "surface-context":
    "A surface-colored container must publish its context for nested sticky regions. Add `--ui-surface-context: var(--ui-color-surface)` beside the background declaration.",
  "scroll-container-size":
    "A scrolling flex/grid descendant must be allowed to shrink. Add `min-width: 0` for horizontal scrolling or `min-height: 0` for vertical scrolling to prevent intrinsic content from expanding its pane.",
};

function splitCssValues(value) {
  const values = [];
  let current = "";
  let depth = 0;
  for (const character of value.trim()) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (/\s/.test(character) && depth === 0) {
      if (current) values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  if (current) values.push(current);
  return values;
}

function isZero(value) {
  return /^(?:0|0\.0+)(?:px|rem|em|%|vh|vw|dvh)?$/.test(value.trim().toLowerCase());
}

function createsOuterGap(value) {
  return !isZero(value) && value.trim().toLowerCase() !== "auto";
}

function fontSizeInRem(value) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(px|rem|em)$/i);
  if (!match) return null;
  const size = Number(match[1]);
  return match[2].toLowerCase() === "px" ? size / 16 : size;
}

function fontShorthandSizeInRem(value) {
  const match = value.match(/(?:^|\s)(\d+(?:\.\d+)?(?:px|rem|em))(?=\/|\s|$)/i);
  return match ? fontSizeInRem(match[1]) : null;
}

function formControlSelector(selector) {
  return /(?:^|[\s>+~,])(?:input|select|textarea)(?=[:.#[\s>+~,]|$)|\.ui-input\b/i.test(selector);
}

function usesAllowedRadius(value) {
  return splitCssValues(value).every(
    (part) => part.startsWith("var(") || isZero(part) || part.toLowerCase() === "50%" || part.toLowerCase() === "999px",
  );
}

function containsRawColor(value) {
  return /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(|\b(?:white|black|red|green|blue)\b/i.test(value);
}

function bottomValue(values) {
  if (values.length === 1) return values[0];
  if (values.length === 2 || values.length === 3) return values[1];
  return values[2];
}

function hasTopOnlyCorners(value) {
  const values = splitCssValues(value);
  return values.length === 4 && isZero(values[2]) && isZero(values[3]) && !isZero(values[0]) && !isZero(values[1]);
}

function isSuppressed(rule, ruleId) {
  const previous = rule.prev();
  return (
    previous?.type === "comment" &&
    new RegExp(`^\\s*ui-contract-disable-next-line\\s+${ruleId}\\s+--\\s+\\S`).test(previous.text)
  );
}

export function lintCss(source, from = "input.css") {
  const diagnostics = [];
  const stylesheet = postcss.parse(source, { from });

  const report = (rule, ruleId) => {
    if (isSuppressed(rule, ruleId)) return;
    diagnostics.push({
      file: from,
      line: rule.source?.start?.line ?? 1,
      column: rule.source?.start?.column ?? 1,
      ruleId,
      message: messages[ruleId],
    });
  };

  stylesheet.walkRules((rule) => {
    const declarations = new Map();
    rule.walkDecls((declaration) => declarations.set(declaration.prop.toLowerCase(), declaration.value.trim()));
    const selector = rule.selector;
    const normalizedFrom = from.replaceAll("\\", "/");
    const isTokenFile = normalizedFrom.endsWith("packages/ui/src/styles/tokens.css");
    const isPrimitiveOrLab =
      normalizedFrom.endsWith("packages/ui/src/styles/components.css") || normalizedFrom.startsWith("apps/ui-lab/");
    const position = declarations.get("position")?.toLowerCase();
    const borderRadius = declarations.get("border-radius");

    if (
      !isPrimitiveOrLab &&
      !/(?:sheet|dialog|overlay|backdrop)/i.test(selector) &&
      ["height", "min-height", "max-height"].some((property) =>
        /calc\(\s*100dvh\s*-/i.test(declarations.get(property) ?? ""),
      )
    ) {
      report(rule, "viewport-stack-height");
    }

    if (/(?:sheet|dialog-content)/i.test(selector) && borderRadius && hasTopOnlyCorners(borderRadius)) {
      if (!isZero(declarations.get("bottom") ?? "")) report(rule, "bottom-sheet-edge");
      const marginBottom = declarations.get("margin-bottom");
      const margin = declarations.get("margin");
      if (
        (marginBottom && createsOuterGap(marginBottom)) ||
        (margin && createsOuterGap(bottomValue(splitCssValues(margin)) ?? ""))
      ) {
        report(rule, "bottom-sheet-margin");
      }
    }

    if (position === "sticky") {
      const top = declarations.get("top");
      if (
        top &&
        !isZero(top) &&
        !/^var\(--[\w-]*sticky[\w-]*-offset\)$/.test(top) &&
        !(
          normalizedFrom.endsWith("packages/ui/src/styles/components.css") &&
          selector.includes("ui-sticky-stack-viewport")
        )
      ) {
        report(rule, "sticky-stack-offset");
      }

      if (
        isZero(declarations.get("bottom") ?? "") &&
        !normalizedFrom.endsWith("packages/ui/src/styles/components.css") &&
        !selector.includes("ui-action-bar-sticky")
      ) {
        report(rule, "sticky-action-component");
      }

      const background = declarations.get("background") ?? declarations.get("background-color");
      const usesSurfaceStrategy = /ui-(?:sticky-surface|action-bar-sticky)/.test(selector);
      const hasVisibleBackground = background && !/^(?:transparent|none|initial|unset|inherit)$/i.test(background);
      if (!hasVisibleBackground && !usesSurfaceStrategy) report(rule, "sticky-surface");
    }

    if (
      !isPrimitiveOrLab &&
      position === "sticky" &&
      [...declarations.values()].some((value) => value.includes("--ui-viewport-available-height"))
    ) {
      report(rule, "sticky-viewport-component");
    }

    const hasInlineBleed = declarations.has("--ui-sticky-surface-inline-bleed");
    const hasBottomBleed = declarations.has("--ui-sticky-surface-block-end-bleed");
    if (hasInlineBleed !== hasBottomBleed) report(rule, "sticky-bleed-pair");

    const hasViewportStartGap = declarations.has("--ui-sticky-viewport-block-start-gap");
    const hasViewportEndGap = declarations.has("--ui-sticky-viewport-block-end-gap");
    if (hasViewportStartGap !== hasViewportEndGap) report(rule, "sticky-viewport-gap-pair");

    if (
      declarations.get("display") === "grid" &&
      declarations.has("grid-template-columns") &&
      /^(?:start|flex-start)$/.test(declarations.get("align-items") ?? "") &&
      /(?:layout|split)/i.test(selector) &&
      !selector.includes("ui-split-layout")
    ) {
      report(rule, "split-layout-component");
    }

    const fontSize = declarations.get("font-size");
    const shorthandFontSize = fontShorthandSizeInRem(declarations.get("font") ?? "");
    if (
      formControlSelector(selector) &&
      ((fontSize && (fontSizeInRem(fontSize) ?? 1) < 1) || (shorthandFontSize !== null && shorthandFontSize < 1))
    ) {
      report(rule, "mobile-form-font-size");
    }

    const zIndex = declarations.get("z-index");
    if (zIndex && !/^(?:var\(|auto|inherit|initial|unset)/i.test(zIndex)) report(rule, "z-index-token");

    if (!isTokenFile) {
      const colorProperties = [
        "color",
        "background",
        "background-color",
        "border",
        "border-color",
        "border-top",
        "border-right",
        "border-bottom",
        "border-left",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "outline",
        "outline-color",
        "fill",
        "stroke",
        "text-shadow",
      ];
      const rawCustomColor = [...declarations].some(
        ([property, value]) => property.startsWith("--") && containsRawColor(value),
      );
      if (rawCustomColor || colorProperties.some((property) => containsRawColor(declarations.get(property) ?? ""))) {
        report(rule, "design-token-color");
      }

      const radius = declarations.get("border-radius");
      if (radius && !usesAllowedRadius(radius)) report(rule, "design-token-radius");

      const shadow = declarations.get("box-shadow");
      if (shadow && shadow !== "none" && !/^var\([^)]*\)$/.test(shadow)) report(rule, "design-token-shadow");
    }

    const fullScreenOverlay =
      position === "fixed" && /(?:overlay|backdrop)/i.test(selector) && declarations.get("inset") === "0";
    const localBottomSheet =
      /(?:sheet|drawer|dialog)/i.test(selector) &&
      /^(?:fixed|absolute)$/.test(position ?? "") &&
      isZero(declarations.get("bottom") ?? "") &&
      Boolean(borderRadius && hasTopOnlyCorners(borderRadius));
    if (!isPrimitiveOrLab && (fullScreenOverlay || localBottomSheet)) report(rule, "overlay-component");

    const background = declarations.get("background") ?? declarations.get("background-color");
    if (background === "var(--ui-color-surface)" && !declarations.has("--ui-surface-context")) {
      report(rule, "surface-context");
    }

    const horizontalOverflow = /^(?:auto|scroll)$/.test(declarations.get("overflow-x") ?? "");
    const verticalOverflow = /^(?:auto|scroll)$/.test(declarations.get("overflow-y") ?? "");
    if (
      (horizontalOverflow && !declarations.has("min-width")) ||
      (verticalOverflow && !declarations.has("min-height"))
    ) {
      report(rule, "scroll-container-size");
    }
  });

  return diagnostics;
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || ["build", "dist", "node_modules", "out"].includes(entry.name)) return [];
        return cssFiles(target);
      }
      return entry.name.endsWith(".css") ? [target] : [];
    }),
  );
  return files.flat();
}

async function requestedFiles(arguments_) {
  const explicit = arguments_.filter((argument) => argument.endsWith(".css"));
  if (explicit.length > 0) {
    const existing = await Promise.all(
      explicit.map(async (file) => {
        const absolute = path.resolve(root, file);
        try {
          return (await stat(absolute)).isFile() ? absolute : null;
        } catch {
          return null;
        }
      }),
    );
    return existing.filter(Boolean);
  }
  return (await Promise.all([cssFiles(path.join(root, "apps")), cssFiles(path.join(root, "packages"))])).flat();
}

export async function lintFiles(arguments_ = []) {
  const files = await requestedFiles(arguments_);
  const diagnostics = [];
  for (const file of files) {
    const relative = path.relative(root, file);
    if (ignoredFiles.has(relative)) continue;
    diagnostics.push(...lintCss(await readFile(file, "utf8"), relative));
  }
  return diagnostics;
}

async function main() {
  const diagnostics = await lintFiles(process.argv.slice(2));
  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ui-contract/${diagnostic.ruleId} ${diagnostic.message}`,
    );
  }
  if (diagnostics.length > 0) {
    console.error(`UI contract lint failed with ${diagnostics.length} error${diagnostics.length === 1 ? "" : "s"}.`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
