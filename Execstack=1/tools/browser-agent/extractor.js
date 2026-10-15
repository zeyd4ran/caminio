/**
 * extractor.js
 * Pulls raw DOM HTML and the Playwright accessibility tree from the current page.
 * No screenshots — text-only extraction.
 */

/**
 * Extract page state: raw HTML + accessibility tree snapshot.
 * @param {import("playwright").Page} page
 * @returns {Promise<{ html: string, accessibilityTree: object, url: string, title: string }>}
 */
async function extractPageState(page) {
  console.log("[Extractor] Extracting DOM + accessibility tree...");

  const [html, accessibilityTree, title] = await Promise.all([
    page.content(),
    page.accessibility.snapshot({ interestingOnly: true }),
    page.title(),
  ]);

  console.log(
    `[Extractor] Done — HTML length: ${html.length}, ` +
    `a11y nodes: ${countNodes(accessibilityTree)}`
  );

  return {
    html,
    accessibilityTree: accessibilityTree ?? {},
    url: page.url(),
    title,
  };
}

function countNodes(node, count = 0) {
  if (!node) return count;
  count++;
  for (const child of node.children ?? []) {
    count = countNodes(child, count);
  }
  return count;
}

export { extractPageState };
