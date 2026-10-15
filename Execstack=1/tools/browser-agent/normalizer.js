/**
 * normalizer.js
 * Converts raw DOM + accessibility tree into a clean, LLM-friendly JSON structure.
 * Extracts only actionable elements: buttons, inputs, links, headings.
 * No images, no screenshots, no noise.
 */

const MAX_ELEMENTS = 50;
const MAX_TEXT_LENGTH = 120;

const ROLE_MAP = {
  button: "button",
  link: "link",
  textbox: "input",
  searchbox: "input",
  combobox: "input",
  checkbox: "checkbox",
  radio: "radio",
  heading: "heading",
  menuitem: "button",
  tab: "button",
  listitem: null,
  generic: null,
};

let elementCounter = 0;

function nextId() {
  return `el_${++elementCounter}`;
}

function trim(text) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}

/**
 * Recursively walk the accessibility tree and collect useful nodes.
 * @param {object} node
 * @param {object[]} results
 */
function walkTree(node, results) {
  if (!node || results.length >= MAX_ELEMENTS) return;

  const mappedType = ROLE_MAP[node.role] ?? null;

  if (mappedType && node.name) {
    const element = {
      id: nextId(),
      type: mappedType,
      role: node.role,
      text: trim(node.name),
    };

    if (node.role === "textbox" || node.role === "searchbox" || node.role === "combobox") {
      element.label = trim(node.name);
      element.value = trim(node.value) || null;
      element.placeholder = trim(node.placeholder) || null;
    }

    if (node.role === "heading") {
      element.level = node.level ?? null;
    }

    if (node.role === "link" && node.url) {
      element.href = node.url;
    }

    if (node.disabled) {
      element.disabled = true;
    }

    if (!node.disabled) {
      results.push(element);
    }
  }

  for (const child of node.children ?? []) {
    walkTree(child, results);
  }
}

/**
 * Normalize raw page state into structured LLM-ready JSON.
 * @param {{ html: string, accessibilityTree: object, url: string, title: string }} rawState
 * @returns {{ url: string, title: string, elements: object[] }}
 */
function normalize(rawState) {
  elementCounter = 0;
  const elements = [];

  walkTree(rawState.accessibilityTree, elements);

  const result = {
    url: rawState.url,
    title: trim(rawState.title),
    elements,
  };

  console.log(`[Normalizer] Extracted ${elements.length} actionable elements`);
  return result;
}

export { normalize };
