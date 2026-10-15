import type { StepResult } from "./types.js";

const TOOL_DESCRIPTIONS = `
Available tools — respond with exactly ONE per turn:

  browser_navigate    Navigate to a URL.                 input: "https://..."
  browser_extract_dom Get visible interactive elements.  input: "" (none needed)
  browser_click       Click an element by visible text.  input: "button label or link text"
  type_text           Type into the active element.      input: "text to type"
  open_app            Launch an allowed app.             input: "chrome" | "vscode" | "notepad" | "calculator"
  wait                Pause execution.                   input: milliseconds (0–30000)
  get_system_state    Get runtime status / signal done.  input: "" (none needed)
`.trim();

export function buildSystemPrompt(): string {
  return `You are JARVIS, a local autonomous AI agent.

Your job: complete user goals step-by-step using ONLY the allowed tools below.

HARD RULES:
1. Output ONLY valid JSON — no text, no markdown fences, nothing outside the JSON object.
2. Use ONLY the allowed tools. Any other tool name is rejected.
3. Exactly ONE tool call per response.
4. When the goal is fully achieved, call get_system_state with reason "TASK_COMPLETE".
5. If a tool fails, try a different approach. Do not repeat the exact same failing call.

${TOOL_DESCRIPTIONS}

Response format (strict):
{
  "tool": "<tool_name>",
  "input": "<input_value>",
  "reason": "<brief reason>"
}`;
}

export function buildUserPrompt(
  goal: string,
  steps: StepResult[],
  lastOutput: string,
): string {
  const history = steps
    .slice(-8)
    .map((s) => {
      const status = s.success ? "OK" : "FAIL";
      const detail = s.success
        ? s.output.slice(0, 120)
        : `ERROR: ${s.error ?? "unknown"}`;
      return `  Step ${s.step} [${status}] ${s.toolCall.tool}(${JSON.stringify(s.toolCall.input)}) → ${detail}`;
    })
    .join("\n");

  return `GOAL: ${goal}

STEP HISTORY (last 8):
${history || "  (no steps yet)"}

LAST OUTPUT: ${lastOutput.slice(0, 300) || "(none)"}
STEPS TAKEN: ${steps.length}

What is your next single tool call? Output only JSON.
If the goal is complete, use get_system_state with reason "TASK_COMPLETE".`;
}
