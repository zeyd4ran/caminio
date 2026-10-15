import { describe, expect, it, vi } from "vitest";
import { runJarvis, type JarvisPipelineDependencies } from "../../../packages/jarvis-core/src/orchestrator.js";
import type { ToolCall } from "../../../packages/jarvis-core/src/types.js";

function response(call: ToolCall): string {
  return JSON.stringify(call);
}

function makeClient(responses: string[]) {
  let nextResponse = 0;
  return {
    isAvailable: vi.fn(async () => true),
    generate: vi.fn(async () => {
      const current = responses[Math.min(nextResponse, responses.length - 1)];
      nextResponse += 1;
      return current ?? response({
        tool: "get_system_state",
        input: "",
        reason: "TASK_COMPLETE",
      });
    }),
    parseToolCall: vi.fn((raw: string) => JSON.parse(raw) as ToolCall),
  };
}

function dependencies(
  client: ReturnType<typeof makeClient>,
  execute: (call: ToolCall) => Promise<string> = async () => "ok",
): JarvisPipelineDependencies {
  return {
    createOllamaClient: () => client,
    executeTool: vi.fn(execute),
    getCurrentBrowserUrl: () => "https://example.com/form",
    closeBrowserSession: vi.fn(async () => undefined),
  };
}

const completion = response({
  tool: "get_system_state",
  input: "",
  reason: "TASK_COMPLETE",
});

describe("Jarvis pipeline controller", () => {
  it("denies risky actions unless the user explicitly approves them", async () => {
    const rawInput = "private form value";
    const client = makeClient([
      response({ tool: "type_text", input: rawInput, reason: "Fill the form" }),
      completion,
    ]);
    const deps = dependencies(client);
    const confirm = vi.fn(async () => false);

    const result = await runJarvis(
      {
        goal: "Fill a form",
        sessionId: "test-denied-risky-action",
        maxSteps: 4,
        stepTimeoutMs: 500,
        onConfirmationRequired: confirm,
      },
      deps,
    );

    expect(confirm).toHaveBeenCalledOnce();
    expect(deps.executeTool).not.toHaveBeenCalled();
    expect(result.steps[0]?.success).toBe(false);
    expect(String(result.steps[0]?.toolCall.input)).toContain("redacted");
    expect(result.auditLog.map((entry) => entry.status)).toEqual([
      "confirmation_requested",
      "denied",
      "completed",
    ]);
    expect(JSON.stringify(result.auditLog)).not.toContain(rawInput);
  });

  it("executes a risky action only after approval and records a redacted audit trail", async () => {
    const rawInput = "private form value";
    const client = makeClient([
      response({ tool: "type_text", input: rawInput, reason: "Fill the form" }),
      completion,
    ]);
    const deps = dependencies(client, async () => "typed successfully");

    const result = await runJarvis(
      {
        goal: "Fill a form",
        sessionId: "test-approved-risky-action",
        maxSteps: 4,
        stepTimeoutMs: 500,
        onConfirmationRequired: async () => true,
      },
      deps,
    );

    expect(deps.executeTool).toHaveBeenCalledOnce();
    expect(result.steps[0]?.success).toBe(true);
    expect(String(result.steps[0]?.toolCall.input)).toContain("redacted");
    expect(result.auditLog.map((entry) => entry.status)).toEqual([
      "confirmation_requested",
      "approved",
      "succeeded",
      "completed",
    ]);
    expect(JSON.stringify(result.auditLog)).not.toContain(rawInput);
  });

  it("does not execute more than the configured maximum number of steps", async () => {
    const client = makeClient([
      response({ tool: "wait", input: "0", reason: "first" }),
      response({ tool: "wait", input: "0", reason: "second" }),
      response({ tool: "wait", input: "0", reason: "unexpected third step" }),
    ]);
    const deps = dependencies(client);

    const result = await runJarvis(
      {
        goal: "Use exactly two steps",
        sessionId: "test-max-steps",
        maxSteps: 2,
        stepTimeoutMs: 500,
      },
      deps,
    );

    expect(result.steps).toHaveLength(2);
    expect(client.generate).toHaveBeenCalledTimes(2);
    expect(deps.executeTool).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("failed");
  });

  it("fails a session when an individual tool action exceeds its step timeout", async () => {
    const client = makeClient([
      response({ tool: "wait", input: "0", reason: "hang in executor" }),
    ]);
    const deps = dependencies(client, () => new Promise<string>(() => undefined));

    const result = await runJarvis(
      {
        goal: "Exercise the timeout",
        sessionId: "test-step-timeout",
        maxSteps: 5,
        stepTimeoutMs: 20,
      },
      deps,
    );

    expect(result.status).toBe("failed");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.error).toContain("Step timeout");
    expect(result.auditLog.at(-1)?.status).toBe("timed_out");
  });
});
