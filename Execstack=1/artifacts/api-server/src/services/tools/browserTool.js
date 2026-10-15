import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerTool } from "../toolRegistry.js";

let browserAgentPromise;

async function getBrowserAgent() {
  if (!browserAgentPromise) {
    const runtimePath = path.resolve(process.cwd(), "../../tools/browser-agent/runtime.js");
    browserAgentPromise = import(pathToFileURL(runtimePath).href);
  }
  return browserAgentPromise;
}

const browserTool = {
  name: "browser_navigate",
  description: "Navigate and perform actions on a webpage",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["url", "goal"],
    properties: {
      url: { type: "string" },
      goal: { type: "string" },
    },
  },
  safety: "sensitive",
  execute: async ({ url, goal }) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs are allowed");
    }
    const { runBrowserAgent } = await getBrowserAgent();
    return runBrowserAgent({
      url,
      goal,
      maxSteps: 3,
      stepDelayMs: 250,
      navigationTimeoutMs: 7_000,
    });
  },
};

registerTool(browserTool);

export { browserTool };