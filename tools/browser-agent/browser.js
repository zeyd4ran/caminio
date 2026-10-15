/**
 * browser.js
 * Launches a Playwright Chromium browser and opens the target URL.
 */

import { chromium } from "playwright";

/**
 * Initialize the browser and open the start URL.
 * @param {string} [url="https://example.com"]
 * @returns {Promise<{ browser: import("playwright").Browser, page: import("playwright").Page }>}
 */
async function initBrowser(url = "https://example.com", options = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log(`[Browser] Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? 30_000 });
  console.log(`[Browser] Page loaded: ${page.url()}`);

  return { browser, page };
}

export { initBrowser };
