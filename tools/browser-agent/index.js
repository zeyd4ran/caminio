/**
 * index.js — Browser Agent Runtime entry point
 *
 * Loop:
 *   1. Extract DOM + accessibility tree from current page
 *   2. Normalize into structured JSON
 *   3. Ask the agent (LLM mock) to decide an action
 *   4. Execute the action safely via Playwright
 *   5. Repeat (max 10 steps)
 *
 * No screenshots. No raw selectors. Clean structured data flow.
 */

import { runBrowserAgent } from "./runtime.js";

const TARGET_URL = process.env.TARGET_URL || "https://example.com";
const USER_GOAL = process.env.USER_GOAL || "click the first button on the page";
const MAX_STEPS = 10;
const STEP_DELAY_MS = 1_000;

async function run() {
  console.log("━".repeat(60));
  console.log("[BrowserAgent] Starting runtime");
  console.log(`[BrowserAgent] URL:  ${TARGET_URL}`);
  console.log(`[BrowserAgent] Goal: ${USER_GOAL}`);
  console.log("━".repeat(60));

  const result = await runBrowserAgent({
    url: TARGET_URL,
    goal: USER_GOAL,
    maxSteps: MAX_STEPS,
    stepDelayMs: STEP_DELAY_MS,
  });
  console.log(JSON.stringify(result, null, 2));
  console.log("\n[BrowserAgent] Browser closed. Done.");
}

run().catch((err) => {
  console.error("[BrowserAgent] Fatal error:", err);
  process.exit(1);
});
