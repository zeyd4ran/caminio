import type { ToolName, ToolCall } from "./types.js";

export const ALLOWED_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  "browser_navigate",
  "browser_extract_dom",
  "browser_click",
  "type_text",
  "open_app",
  "wait",
  "get_system_state",
]);

export const ALLOWED_APPS: ReadonlySet<string> = new Set([
  "chrome",
  "chromium",
  "firefox",
  "vscode",
  "code",
  "notepad",
  "explorer",
  "terminal",
  "calculator",
]);

const ALLOWED_BROWSER_DOMAIN_SUFFIXES = ["replit.dev", "replit.app"] as const;

export function isAllowlistedBrowserUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    ) {
      return true;
    }

    return ALLOWED_BROWSER_DOMAIN_SUFFIXES.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function getRiskyToolConfirmationReason(
  call: ToolCall,
  currentUrl: string | null | undefined,
): string | null {
  const origin = (() => {
    try {
      return currentUrl ? new URL(currentUrl).origin : "an unknown page";
    } catch {
      return "an unknown page";
    }
  })();

  if (call.tool === "type_text") {
    const characterCount = String(call.input ?? "").length;
    return `Jarvis wants to type ${characterCount} characters into the page at ${origin}.`;
  }

  if (call.tool === "browser_click" && !isAllowlistedBrowserUrl(currentUrl)) {
    return `Jarvis wants to click on ${origin}, which is outside the browser domain allowlist.`;
  }

  return null;
}

export function validateTool(call: ToolCall): string | null {
  if (!ALLOWED_TOOLS.has(call.tool)) {
    return `Tool "${call.tool}" is not allowed. Allowed tools: ${[...ALLOWED_TOOLS].join(", ")}`;
  }

  if (call.tool === "open_app") {
    const app = String(call.input ?? "")
      .toLowerCase()
      .trim();
    if (!ALLOWED_APPS.has(app)) {
      return `App "${app}" is not in the allowed list. Allowed: ${[...ALLOWED_APPS].join(", ")}`;
    }
  }

  if (call.tool === "browser_navigate") {
    const url = String(call.input ?? "");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `browser_navigate requires a full URL (http:// or https://), got: "${url}"`;
    }
  }

  if (call.tool === "wait") {
    const ms = Number(call.input);
    if (isNaN(ms) || ms < 0 || ms > 30_000) {
      return `wait input must be 0–30000 milliseconds, got: "${call.input}"`;
    }
  }

  return null;
}

export function isTaskComplete(call: ToolCall): boolean {
  return (
    call.tool === "get_system_state" &&
    typeof call.reason === "string" &&
    call.reason.toUpperCase().includes("TASK_COMPLETE")
  );
}
