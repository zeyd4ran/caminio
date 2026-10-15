import { OllamaClient } from "./ollama-client.js";
import {
  getRiskyToolConfirmationReason,
  isTaskComplete,
  validateTool,
} from "./tool-registry.js";
import {
  closeBrowserSession,
  executeTool,
  getCurrentBrowserUrl,
} from "./executor.js";
import {
  addAuditRecord,
  createSession,
  addStep,
  completeSession,
  getSession,
} from "./memory.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import type {
  JarvisRunOptions,
  JarvisRunResult,
  StepResult,
  ToolAuditRecord,
  ToolCall,
  ToolConfirmationRequest,
} from "./types.js";

const MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_MAX_STEPS = 25;
const DEFAULT_STEP_TIMEOUT_MS = 60_000;
const DEFAULT_MODEL = "llama3.1";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";

interface OllamaPipelineClient {
  isAvailable(): Promise<boolean>;
  generate(userPrompt: string, systemPrompt: string): Promise<string>;
  parseToolCall(raw: string): ToolCall;
}

export interface JarvisPipelineDependencies {
  createOllamaClient?: (url: string, model: string) => OllamaPipelineClient;
  executeTool?: (call: ToolCall) => Promise<string>;
  getCurrentBrowserUrl?: () => string | null;
  closeBrowserSession?: () => Promise<void>;
}

class StepTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Step timeout after ${timeoutMs}ms`);
    this.name = "StepTimeoutError";
  }
}

function withStepTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StepTimeoutError(timeoutMs)), timeoutMs);
  });

  const execution = Promise.resolve().then(operation);
  return Promise.race([execution, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function normalizeBoundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function safeBrowserOrigin(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function safeToolCallForSession(call: ToolCall): ToolCall {
  const rawInput = String(call.input ?? "");
  let input = call.input;

  if (call.tool === "type_text" || call.tool === "browser_click") {
    input = `[redacted; ${rawInput.length} characters]`;
  } else if (call.tool === "browser_navigate") {
    try {
      input = new URL(rawInput).origin;
    } catch {
      input = "[redacted URL]";
    }
  }

  return { ...call, input };
}

export async function runJarvis(
  options: JarvisRunOptions,
  dependencies: JarvisPipelineDependencies = {},
): Promise<JarvisRunResult> {
  const {
    goal,
    sessionId,
    model = DEFAULT_MODEL,
    ollamaUrl = DEFAULT_OLLAMA_URL,
    onStep,
    onAudit,
    onConfirmationRequired,
  } = options;
  const maxSteps = normalizeBoundedInteger(
    options.maxSteps,
    DEFAULT_MAX_STEPS,
    1,
    50,
  );
  const stepTimeoutMs = normalizeBoundedInteger(
    options.stepTimeoutMs,
    DEFAULT_STEP_TIMEOUT_MS,
    1,
    120_000,
  );

  const memory = createSession(goal, sessionId, options.userId ?? "");
  const ollama =
    dependencies.createOllamaClient?.(ollamaUrl, model) ??
    new OllamaClient(ollamaUrl, model);
  const execute = dependencies.executeTool ?? executeTool;
  const getBrowserUrl =
    dependencies.getCurrentBrowserUrl ?? getCurrentBrowserUrl;
  const closeBrowser = dependencies.closeBrowserSession ?? closeBrowserSession;
  const systemPrompt = buildSystemPrompt();
  const recordStep = (result: StepResult) => {
    const safeResult = { ...result, toolCall: safeToolCallForSession(result.toolCall) };
    addStep(memory.sessionId, safeResult);
    onStep?.(safeResult);
  };
  const recordAudit = (
    status: ToolAuditRecord["status"],
    call: ToolCall,
    currentUrl: string | null,
  ) => {
    const auditRecord: ToolAuditRecord = {
      step: memory.steps.length + 1,
      tool: call.tool,
      status,
      inputLength: String(call.input ?? "").length,
      browserOrigin: safeBrowserOrigin(currentUrl),
      timestamp: new Date().toISOString(),
    };
    addAuditRecord(memory.sessionId, auditRecord);
    onAudit?.(auditRecord);
  };

  const available = await ollama.isAvailable();
  if (!available) {
    completeSession(memory.sessionId, "failed");
    throw new Error(
      `Ollama is not reachable at ${ollamaUrl}. ` +
        `Start it with: ollama serve\n` +
        `Then pull a model: ollama pull ${model}`,
    );
  }

  let lastOutput = "";
  let consecutiveFailures = 0;

  try {
    while (
      memory.steps.length < maxSteps &&
      memory.status === "running" &&
      consecutiveFailures < MAX_CONSECUTIVE_FAILURES
    ) {
      const currentSession = getSession(memory.sessionId);
      if (!currentSession || currentSession.status !== "running") break;

      const stepDeadline = Date.now() + stepTimeoutMs;
      const remainingStepTime = () =>
        Math.max(1, stepDeadline - Date.now());
      const userPrompt = buildUserPrompt(goal, memory.steps, lastOutput);

      let rawResponse: string;
      try {
        rawResponse = await withStepTimeout(
          () => ollama.generate(userPrompt, systemPrompt),
          remainingStepTime(),
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const result: StepResult = {
          step: memory.steps.length + 1,
          toolCall: { tool: "get_system_state", input: "", reason: "timeout" },
          output: "",
          success: false,
          error: errMsg,
          timestamp: new Date().toISOString(),
        };
        recordStep(result);
        consecutiveFailures++;
        lastOutput = errMsg;
        continue;
      }

      let toolCall: ToolCall;
      try {
        toolCall = ollama.parseToolCall(rawResponse);
      } catch (err) {
        consecutiveFailures++;
        lastOutput = `Parse error: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }

      if (isTaskComplete(toolCall)) {
        recordAudit("completed", toolCall, getBrowserUrl());
        completeSession(memory.sessionId, "completed");
        break;
      }

      const currentUrl = getBrowserUrl();
      const validationError = validateTool(toolCall);
      if (validationError) {
        recordAudit("blocked", toolCall, currentUrl);
        const result: StepResult = {
          step: memory.steps.length + 1,
          toolCall,
          output: "",
          success: false,
          error: `Validation: ${validationError}`,
          timestamp: new Date().toISOString(),
        };
        recordStep(result);
        lastOutput = result.error ?? "";
        consecutiveFailures++;
        continue;
      }

      const confirmationReason = getRiskyToolConfirmationReason(
        toolCall,
        currentUrl,
      );
      if (confirmationReason) {
        recordAudit("confirmation_requested", toolCall, currentUrl);
        let approved = false;
        let confirmationTimedOut = false;
        if (onConfirmationRequired) {
          try {
            const request: ToolConfirmationRequest = {
              sessionId: memory.sessionId,
              toolCall,
              currentUrl,
              reason: confirmationReason,
            };
            approved = await withStepTimeout(
              () => onConfirmationRequired(request),
              remainingStepTime(),
            );
          } catch (err) {
            confirmationTimedOut = err instanceof StepTimeoutError;
          }
        }

        if (confirmationTimedOut) {
          recordAudit("timed_out", toolCall, currentUrl);
          consecutiveFailures = MAX_CONSECUTIVE_FAILURES;
          const error = `Confirmation timed out after ${stepTimeoutMs}ms; action was not executed.`;
          recordStep({
            step: memory.steps.length + 1,
            toolCall,
            output: "",
            success: false,
            error,
            timestamp: new Date().toISOString(),
          });
          break;
        }

        if (!approved) {
          recordAudit("denied", toolCall, currentUrl);
          const error = "Confirmation was denied or unavailable; action was not executed.";
          recordStep({
            step: memory.steps.length + 1,
            toolCall,
            output: "",
            success: false,
            error,
            timestamp: new Date().toISOString(),
          });
          lastOutput = error;
          consecutiveFailures++;
          continue;
        }

        recordAudit("approved", toolCall, currentUrl);
      }

      let output = "";
      let success = false;
      let error: string | undefined;
      let executionTimedOut = false;

      try {
        output = await withStepTimeout(
          () => execute(toolCall),
            remainingStepTime(),
        );
        success = true;
        consecutiveFailures = 0;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        executionTimedOut = err instanceof StepTimeoutError;
        if (!executionTimedOut) consecutiveFailures++;
      }

      recordAudit(
        executionTimedOut
          ? "timed_out"
          : success
            ? "succeeded"
            : "failed",
        toolCall,
        currentUrl,
      );
      const result: StepResult = {
        step: memory.steps.length + 1,
        toolCall,
        output,
        success,
        error,
        timestamp: new Date().toISOString(),
      };

      recordStep(result);
      lastOutput = success ? output.slice(0, 400) : (error ?? "");
      if (executionTimedOut) {
        consecutiveFailures = MAX_CONSECUTIVE_FAILURES;
        break;
      }
    }
  } finally {
    await closeBrowser().catch(() => undefined);
  }

  const finalSession = getSession(memory.sessionId);
  if (finalSession && finalSession.status === "running") {
    const reachedMaxSteps = finalSession.steps.length >= maxSteps;
    const tooManyFailures = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
    completeSession(
      memory.sessionId,
      reachedMaxSteps || tooManyFailures ? "failed" : "completed",
    );
  }

  const done = getSession(memory.sessionId)!;
  return {
    sessionId: done.sessionId,
    goal: done.goal,
    steps: done.steps,
    auditLog: done.auditLog,
    status: done.status,
    completedAt: done.completedAt ?? new Date().toISOString(),
  };
}

export {
  getSessionForUser,
  getAllSessionsForUser,
  stopSession,
} from "./memory.js";
