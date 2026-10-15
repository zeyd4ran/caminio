import { describe, expect, it, vi } from "vitest";
import { executeTool, type BrowserSession } from "../../../packages/jarvis-core/src/executor.js";
import type { ToolCall } from "../../../packages/jarvis-core/src/types.js";

function makeSession(): BrowserSession {
  return {
    navigate: vi.fn(async () => "navigated"),
    extractDom: vi.fn(async () => "dom"),
    click: vi.fn(async () => "clicked"),
    typeText: vi.fn(async () => "typed"),
    currentUrl: vi.fn(() => "https://example.com"),
    close: vi.fn(async () => undefined),
  };
}

describe("Jarvis executor", () => {
  it("uses the supplied browser session for browser actions", async () => {
    const session = makeSession();
    const getBrowserSession = vi.fn(async () => session);

    const output = await executeTool(
      { tool: "browser_click", input: "Continue", reason: "unit test" },
      { getBrowserSession },
    );

    expect(output).toBe("clicked");
    expect(getBrowserSession).toHaveBeenCalledOnce();
    expect(session.click).toHaveBeenCalledWith("Continue");
  });

  it("types only when invoked and does not echo the typed value itself", async () => {
    const session = makeSession();
    session.typeText = vi.fn(async () => "Typed into the active element.");
    const secretText = "do-not-echo-this";

    const output = await executeTool(
      { tool: "type_text", input: secretText, reason: "unit test" },
      { getBrowserSession: async () => session },
    );

    expect(session.typeText).toHaveBeenCalledWith(secretText);
    expect(output).not.toContain(secretText);
  });

  it("does not launch applications outside the existing allowlist", async () => {
    const getBrowserSession = vi.fn(async () => makeSession());
    const call: ToolCall = {
      tool: "open_app",
      input: "powershell",
      reason: "unit test",
    };

    const output = await executeTool(call, { getBrowserSession });

    expect(output).toContain("not in the allowed list");
    expect(getBrowserSession).not.toHaveBeenCalled();
  });
});
