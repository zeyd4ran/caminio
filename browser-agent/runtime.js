import { initBrowser } from "./browser.js";
import { extractPageState } from "./extractor.js";
import { normalize } from "./normalizer.js";
import { llmDecide } from "./agent.js";
import { executeAction } from "./executor.js";

async function runBrowserAgent({
  url = "https://example.com",
  goal = "click the first button on the page",
  maxSteps = 10,
  stepDelayMs = 1_000,
  navigationTimeoutMs = 30_000,
} = {}) {
  const { browser, page } = await initBrowser(url, { timeoutMs: navigationTimeoutMs });
  const steps = [];
  let step = 0;
  let done = false;
  let lastPage = null;

  try {
    while (step < maxSteps && !done) {
      step++;
      const rawState = await extractPageState(page);
      const structuredPage = normalize(rawState);
      lastPage = {
        url: structuredPage.url,
        title: structuredPage.title,
        elementCount: structuredPage.elements.length,
      };

      const action = await llmDecide(structuredPage, goal);
      const record = {
        step,
        page: lastPage,
        action,
        status: "pending",
      };

      if (!action) {
        record.status = "completed";
        record.message = "Agent returned no action";
        steps.push(record);
        done = true;
        break;
      }

      try {
        await executeAction(page, action, structuredPage.elements);
        record.status = "completed";
      } catch (err) {
        record.status = "failed";
        record.error = err instanceof Error ? err.message : String(err);
      }

      steps.push(record);
      if (stepDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
    }

    return {
      url: page.url(),
      title: await page.title().catch(() => lastPage?.title ?? ""),
      goal,
      steps,
      maxStepsReached: step >= maxSteps && !done,
    };
  } finally {
    await browser.close();
  }
}

export { runBrowserAgent };