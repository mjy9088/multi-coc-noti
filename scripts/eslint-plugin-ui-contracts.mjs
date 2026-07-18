const interactiveElements = new Set(["button", "a", "input", "select", "textarea", "summary"]);
const containerElements = new Set(["article", "div", "section", "span"]);

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
};

export default { rules };
