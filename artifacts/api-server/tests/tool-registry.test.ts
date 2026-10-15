import { describe, expect, it } from "vitest";
import {
  ALLOWED_APPS,
  getRiskyToolConfirmationReason,
  isAllowlistedBrowserUrl,
  validateTool,
} from "../../../packages/jarvis-core/src/tool-registry.js";
import type { ToolCall } from "../../../packages/jarvis-core/src/types.js";

function makeCall(tool: ToolCall["tool"], input: string): ToolCall {
  return { tool, input, reason: "unit test" };
}

describe("Jarvis tool registry", () => {
  it("keeps the application allowlist and rejects applications outside it", () => {
    expect(ALLOWED_APPS.has("chrome")).toBe(true);
    expect(ALLOWED_APPS.has("terminal")).toBe(true);
    expect(validateTool(makeCall("open_app", "chrome"))).toBeNull();
    expect(validateTool(makeCall("open_app", "powershell"))).toContain(
      "not in the allowed list",
    );
  });

  it("requires full HTTP URLs for browser navigation", () => {
    expect(validateTool(makeCall("browser_navigate", "https://example.com"))).toBeNull();
    expect(validateTool(makeCall("browser_navigate", "javascript:alert(1)"))).toContain(
      "requires a full URL",
    );
  });

  it("only treats explicit local and Replit domains as browser-allowlisted", () => {
    expect(isAllowlistedBrowserUrl("http://localhost:5173")).toBe(true);
    expect(isAllowlistedBrowserUrl("https://taskflow.replit.dev")).toBe(true);
    expect(isAllowlistedBrowserUrl("https://replit.dev.example.org")).toBe(false);
    expect(isAllowlistedBrowserUrl("https://example.com")).toBe(false);
  });

  it("requires approval before typing and before clicking outside the browser allowlist", () => {
    expect(
      getRiskyToolConfirmationReason(
        makeCall("type_text", "private form value"),
        "https://taskflow.replit.dev/form",
      ),
    ).toContain("type");
    expect(
      getRiskyToolConfirmationReason(
        makeCall("browser_click", "Delete account"),
        "https://example.com/settings",
      ),
    ).toContain("outside the browser domain allowlist");
    expect(
      getRiskyToolConfirmationReason(
        makeCall("browser_click", "Continue"),
        "http://localhost:3000",
      ),
    ).toBeNull();
  });
});
