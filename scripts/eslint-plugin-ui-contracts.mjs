const interactiveElements = new Set(["button", "a", "input", "select", "textarea", "summary"]);
const containerElements = new Set(["article", "div", "section", "span"]);
const sharedCompositionElements = new Set([
  "Card",
  "ContentSection",
  "DataList",
  "DataListItem",
  "DetailPane",
  "EntityHeader",
  "FormGrid",
  "InputField",
  "MasterDetailLayout",
  "MasterPane",
  "PageHeader",
  "PageIntro",
  "ScrollablePane",
  "SelectField",
  "SectionHeader",
  "Stat",
  "StatGrid",
  "Toolbar",
  "TextareaField",
]);

function attribute(node, name) {
  return node.attributes.find((item) => item.type === "JSXAttribute" && item.name.name === name);
}

function elementName(node) {
  return node.name.type === "JSXIdentifier" ? node.name.name : null;
}

const rules = {
  "no-noninteractive-click": {
    meta: {
      type: "problem",
      docs: { description: "Keep click behavior on semantic interactive components" },
      messages: {
        default:
          "Do not attach onClick to a non-interactive <{{name}}>. Use Button for an action, Link for navigation, or Dialog for modal interaction so keyboard and focus behavior come with it.",
      },
      schema: [],
    },
    create(context) {
      return {
        JSXOpeningElement(node) {
          const name = elementName(node);
          if (!name || interactiveElements.has(name) || !containerElements.has(name) || !attribute(node, "onClick"))
            return;
          context.report({ node, messageId: "default", data: { name } });
        },
      };
    },
  },
  "icon-button-label": {
    meta: {
      type: "problem",
      docs: { description: "Require an accessible name for symbol-only buttons" },
      messages: {
        default:
          "A symbol-only button needs a stable accessible name. Prefer IconButton with its `label` prop, or add an `aria-label` when the native button is intentional.",
      },
      schema: [],
    },
    create(context) {
      return {
        JSXElement(node) {
          if (elementName(node.openingElement) !== "button" || attribute(node.openingElement, "aria-label")) return;
          const meaningful = node.children.filter((child) => child.type !== "JSXText" || child.value.trim() !== "");
          if (
            meaningful.length === 1 &&
            meaningful[0].type === "JSXText" &&
            /^[^\p{L}\p{N}]+$/u.test(meaningful[0].value.trim())
          ) {
            context.report({ node: node.openingElement, messageId: "default" });
          }
        },
      };
    },
  },
  "no-legacy-feedback": {
    meta: {
      type: "problem",
      docs: { description: "Keep transient mutation feedback in the shared toast system" },
      messages: {
        default:
          "Do not add feature-local feedback toasts. Mount ToastProvider at the app boundary and publish mutation feedback with useToast.",
      },
      schema: [],
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          if (typeof node.source.value === "string" && /(?:^|\/)feedback-toast$/.test(node.source.value)) {
            context.report({ node, messageId: "default" });
          }
        },
      };
    },
  },
  "no-js-viewport-breakpoint": {
    meta: {
      type: "problem",
      docs: { description: "Keep responsive layout decisions out of duplicated JavaScript breakpoints" },
      messages: {
        default:
          "Do not duplicate a width breakpoint with matchMedia in feature code. Prefer CSS/container queries; when behavior truly depends on measured layout, expose it through an owned responsive context.",
      },
      schema: [],
    },
    create(context) {
      return {
        CallExpression(node) {
          if (
            node.callee.type !== "MemberExpression" ||
            node.callee.property.type !== "Identifier" ||
            node.callee.property.name !== "matchMedia"
          )
            return;
          const query = node.arguments[0];
          if (
            query?.type === "Literal" &&
            typeof query.value === "string" &&
            /\b(?:min|max)-width\s*:/i.test(query.value)
          ) {
            context.report({ node, messageId: "default" });
          }
        },
      };
    },
  },
  "no-magic-layout-threshold": {
    meta: {
      type: "problem",
      docs: { description: "Derive geometry thresholds from the owning measured layout" },
      messages: {
        default:
          "Do not compare measured element geometry with a numeric layout threshold. Use StickyStackProvider/useStickyStack or another owner-provided measurement instead of duplicating an offset.",
      },
      schema: [],
    },
    create(context) {
      const source = context.sourceCode;
      return {
        BinaryExpression(node) {
          if (!/[<>]=?/.test(node.operator)) return;
          const hasNumber =
            (node.left.type === "Literal" && typeof node.left.value === "number") ||
            (node.right.type === "Literal" && typeof node.right.value === "number");
          if (
            hasNumber &&
            /getBoundingClientRect\(\)\.(?:top|right|bottom|left|width|height)/.test(source.getText(node))
          ) {
            context.report({ node, messageId: "default" });
          }
        },
      };
    },
  },
  "sticky-tabs-route-frame": {
    meta: {
      type: "problem",
      docs: { description: "Keep short route content aligned below sticky tabs" },
      messages: {
        missingFrame:
          "A StickyStackItem containing route Tabs needs a following StickyRouteFrame sibling. The frame owns the stable viewport and internal route scrolling without adding blank height to feature content.",
        missingKey:
          "StickyRouteFrame after route Tabs needs a route-specific scrollKey so each destination starts at the top of its internal scroll viewport.",
      },
      schema: [],
    },
    create(context) {
      return {
        JSXElement(node) {
          if (elementName(node.openingElement) !== "StickyStackItem") return;
          const ownsTabs = node.children.some(
            (child) => child.type === "JSXElement" && elementName(child.openingElement) === "Tabs",
          );
          if (!ownsTabs || node.parent?.type !== "JSXElement") return;
          const siblings = node.parent.children;
          const index = siblings.indexOf(node);
          const routeFrame = siblings
            .slice(index + 1)
            .find(
              (sibling) =>
                sibling.type === "JSXElement" &&
                ["StickyRouteFrame", "SettingsRouteFrame"].includes(elementName(sibling.openingElement)),
            );
          if (!routeFrame) {
            context.report({ node: node.openingElement, messageId: "missingFrame" });
          } else if (!attribute(routeFrame.openingElement, "scrollKey")) {
            context.report({ node: routeFrame.openingElement, messageId: "missingKey" });
          }
        },
      };
    },
  },
  "no-shared-composition-classname": {
    meta: {
      type: "suggestion",
      docs: { description: "Keep feature layout rules behind typed app compositions" },
      messages: {
        default:
          "Do not style shared {{name}} directly from a route or feature screen. Add a typed semantic variant to @multi-coc/ui, or wrap it in apps/dashboard/components when the rule is product-specific. Keep className as an escape hatch inside those implementation layers.",
      },
      schema: [],
    },
    create(context) {
      const imported = new Set();
      return {
        ImportDeclaration(node) {
          if (node.source.value !== "@multi-coc/ui") return;
          for (const specifier of node.specifiers) {
            if (specifier.type !== "ImportSpecifier") continue;
            const importedName =
              specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
            if (sharedCompositionElements.has(importedName)) imported.add(specifier.local.name);
          }
        },
        JSXOpeningElement(node) {
          const name = elementName(node);
          if (!name || !imported.has(name) || !attribute(node, "className")) return;
          context.report({ node, messageId: "default", data: { name } });
        },
      };
    },
  },
};

export default { rules };
