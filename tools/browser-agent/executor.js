/**
 * executor.js
 * Safely executes browser actions using Playwright.
 *
 * Safety rules:
 * - NEVER uses raw selectors from the LLM
 * - Maps element IDs (el_1, el_2) to real Playwright locators
 * - Only allows: click, type, scroll
 * - All actions have timeouts
 */

const ACTION_TIMEOUT = 5_000;
const HUMAN_DELAY_MS = 600;

/**
 * Resolve an element ID to a Playwright Locator using the accessibility tree.
 * @param {import("playwright").Page} page
 * @param {object} element - normalized element from normalizer.js
 * @returns {import("playwright").Locator}
 */
function resolveLocator(page, element) {
  const { role, text } = element;

  const playwrightRoleMap = {
    button: "button",
    link: "link",
    input: "textbox",
    checkbox: "checkbox",
    radio: "radio",
    heading: "heading",
  };

  const ariaRole = playwrightRoleMap[element.type] ?? role;

  if (ariaRole && text) {
    return page.getByRole(ariaRole, { name: text, exact: false });
  }

  if (text) {
    return page.getByText(text, { exact: false });
  }

  throw new Error(`Cannot resolve locator for element: ${JSON.stringify(element)}`);
}

/**
 * Execute a single browser action.
 * @param {import("playwright").Page} page
 * @param {{ action: string, target: string|null, value?: string }} action
 * @param {object[]} elements - normalized element list from normalizer.js
 */
async function executeAction(page, action, elements) {
  console.log(`[Executor] Action: ${action.action} | Target: ${action.target ?? "page"} | Value: ${action.value ?? "-"}`);

  await new Promise((r) => setTimeout(r, HUMAN_DELAY_MS));

  if (action.action === "scroll") {
    const direction = action.value === "up" ? -600 : 600;
    await page.evaluate((dy) => window.scrollBy(0, dy), direction);
    console.log(`[Executor] Scrolled ${action.value}`);
    return;
  }

  if (!action.target) {
    throw new Error(`Action "${action.action}" requires a target element ID`);
  }

  const element = elements.find((el) => el.id === action.target);
  if (!element) {
    throw new Error(`Element not found: "${action.target}". Available: ${elements.map((e) => e.id).join(", ")}`);
  }

  const locator = resolveLocator(page, element);

  if (action.action === "click") {
    await locator.first().highlight().catch(() => {});
    await locator.first().click({ timeout: ACTION_TIMEOUT });
    console.log(`[Executor] Clicked: "${element.text}"`);
    return;
  }

  if (action.action === "type") {
    if (!action.value) throw new Error("type action requires a value");
    await locator.first().highlight().catch(() => {});
    await locator.first().fill(action.value, { timeout: ACTION_TIMEOUT });
    console.log(`[Executor] Typed "${action.value}" into: "${element.text ?? element.label}"`);
    return;
  }

  throw new Error(`Unknown action: "${action.action}". Allowed: click, type, scroll`);
}

export { executeAction };
