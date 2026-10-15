import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import type { ToolCall } from "./types.js";

const execFileAsync = promisify(execFile);

export interface BrowserSession {
  navigate(url: string): Promise<string>;
  extractDom(): Promise<string>;
  click(target: string): Promise<string>;
  typeText(text: string): Promise<string>;
  currentUrl(): string | null;
  close(): Promise<void>;
}

export interface ExecutorDependencies {
  getBrowserSession?: () => Promise<BrowserSession>;
}

let activeBrowserSession: BrowserSession | null = null;

async function getBrowserSession(): Promise<BrowserSession> {
  if (activeBrowserSession) return activeBrowserSession;

  let playwrightModule: typeof import("playwright");
  try {
    playwrightModule = await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed in jarvis-core. " +
        "Run: pnpm --filter @workspace/jarvis-core exec playwright install chromium",
    );
  }

  const browser = await playwrightModule.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  });
  const page = await context.newPage();

  activeBrowserSession = {
    async navigate(url: string): Promise<string> {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return `Navigated to ${new URL(page.url()).origin}.`;
    },

    currentUrl(): string | null {
      const url = page.url();
      return url && url !== "about:blank" ? url : null;
    },

    async extractDom(): Promise<string> {
      const state = await page.evaluate(() => {
        const sel =
          'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
        const elements: Array<{ tag: string; text: string; role: string }> = [];
        document.querySelectorAll(sel).forEach((el: Element) => {
          const text = (
            (el as HTMLElement).innerText?.trim() ||
            (el as HTMLInputElement).placeholder ||
            el.getAttribute("aria-label") ||
            el.getAttribute("title") ||
            el.getAttribute("href") ||
            ""
          ).slice(0, 80);
          if (text) {
            elements.push({
              tag: el.tagName.toLowerCase(),
              text,
              role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
            });
          }
        });
        return {
          url: window.location.href,
          title: document.title,
          elements: elements.slice(0, 40),
        };
      });
      return JSON.stringify(state, null, 2);
    },

    async click(target: string): Promise<string> {
      const byText = page.getByText(target, { exact: false }).first();
      const byRole = page.getByRole("button", { name: target }).first();
      const byLink = page.getByRole("link", { name: target }).first();

      for (const locator of [byText, byRole, byLink]) {
        try {
          await locator.click({ timeout: 6_000 });
          return "Clicked the requested control.";
        } catch {
          // try next
        }
      }
      throw new Error("Could not find a clickable element matching the requested label.");
    },

    async typeText(text: string): Promise<string> {
      await page.keyboard.type(text, { delay: 30 });
      return "Typed into the active element.";
    },

    async close(): Promise<void> {
      await browser.close().catch(() => undefined);
      activeBrowserSession = null;
    },
  };

  return activeBrowserSession;
}

export async function closeBrowserSession(): Promise<void> {
  if (activeBrowserSession) {
    await activeBrowserSession.close().catch(() => undefined);
  }
}

export function getCurrentBrowserUrl(): string | null {
  return activeBrowserSession?.currentUrl() ?? null;
}

const APP_COMMANDS: Record<
  string,
  { win: [string, string[]]; linux: [string, string[]] }
> = {
  chrome: {
    win: ["cmd", ["/c", "start", "chrome"]],
    linux: ["google-chrome", ["--no-sandbox"]],
  },
  chromium: {
    win: ["cmd", ["/c", "start", "msedge"]],
    linux: ["chromium-browser", []],
  },
  firefox: {
    win: ["cmd", ["/c", "start", "firefox"]],
    linux: ["firefox", []],
  },
  vscode: {
    win: ["cmd", ["/c", "start", "code"]],
    linux: ["code", ["."]],
  },
  code: {
    win: ["cmd", ["/c", "start", "code"]],
    linux: ["code", ["."]],
  },
  notepad: {
    win: ["cmd", ["/c", "start", "notepad"]],
    linux: ["gedit", []],
  },
  explorer: {
    win: ["cmd", ["/c", "start", "explorer"]],
    linux: ["nautilus", []],
  },
  terminal: {
    win: ["cmd", ["/c", "start", "wt"]],
    linux: ["x-terminal-emulator", []],
  },
  calculator: {
    win: ["cmd", ["/c", "start", "calc"]],
    linux: ["gnome-calculator", []],
  },
};

export async function executeTool(
  call: ToolCall,
  dependencies: ExecutorDependencies = {},
): Promise<string> {
  const acquireBrowserSession =
    dependencies.getBrowserSession ?? getBrowserSession;

  switch (call.tool) {
    case "browser_navigate": {
      const session = await acquireBrowserSession();
      return session.navigate(String(call.input ?? ""));
    }

    case "browser_extract_dom": {
      const session = await acquireBrowserSession();
      return session.extractDom();
    }

    case "browser_click": {
      const session = await acquireBrowserSession();
      return session.click(String(call.input ?? ""));
    }

    case "type_text": {
      const session = await acquireBrowserSession();
      return session.typeText(String(call.input ?? ""));
    }

    case "open_app": {
      const appName = String(call.input ?? "")
        .toLowerCase()
        .trim();
      const cmd = APP_COMMANDS[appName];
      if (!cmd) return `App "${appName}" is not in the allowed list.`;

      const isWindows = platform() === "win32";
      const [exe, args] = isWindows ? cmd.win : cmd.linux;

      try {
        await execFileAsync(exe, args, { timeout: 10_000 });
        return `Launched: ${appName}`;
      } catch (err) {
        return (
          `Could not launch "${appName}" (may not be installed or no desktop environment). ` +
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    case "wait": {
      const ms = Math.min(Math.max(Number(call.input) || 1_000, 0), 30_000);
      await new Promise<void>((resolve) => setTimeout(resolve, ms));
      return `Waited ${ms}ms`;
    }

    case "get_system_state": {
      const mem = process.memoryUsage();
      return JSON.stringify({
        platform: platform(),
        nodeVersion: process.version,
        time: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        memoryMB: {
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
      });
    }

    default: {
      const exhaustive: never = call.tool;
      throw new Error(`Unknown tool: ${exhaustive}`);
    }
  }
}
