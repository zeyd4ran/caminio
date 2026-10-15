import { openai } from "@workspace/integrations-openai-ai-server";
import { Response } from "express";
import { randomUUID } from "node:crypto";
import { runPipeline } from "./pipelineController.js";
import "./tools/browserTool.js";
import { executeTool, listTools } from "./toolRegistry.js";
import { getRecentMemorySummary, storeArtifact } from "./memoryService.js";

export type AgentName = "Planner" | "Architect" | "Coder" | "Security" | "Reviewer" | "Debugger";
export type LogType = "thinking" | "output" | "action" | "error" | "system";
export type RunStatus = "queued" | "running" | "completed" | "stopped" | "failed";

export interface LogEntry {
  id: string;
  timestamp: number;
  agent: AgentName | "System";
  type: LogType;
  content: string;
}

export interface AgentRun {
  id: string;
  userId: string;
  goal: string;
  status: RunStatus;
  createdAt: number;
  updatedAt: number;
  logs: LogEntry[];
  progress: number;
  currentAgent: AgentName | null;
  abortController: AbortController;
  sseClients: Set<Response>;
  toolExecutionConfirmed: boolean;
}

const runs = new Map<string, AgentRun>();

const AGENT_PERSONAS: Record<AgentName, string> = {
  Planner: `You are the Planner agent in a multi-agent AI engineering system. Your role is to:
- Analyze the user's goal carefully
- Break it down into clear, numbered actionable steps
- Identify which agents will handle each step
- Estimate complexity and flag risks
Be concise, structured, and practical. Output a clear execution plan.`,

  Architect: `You are the Architect agent in a multi-agent AI engineering system. Your role is to:
- Review the plan from the Planner
- Validate the technical approach and architecture
- Identify the files, modules, and patterns that need to be involved
- Propose the cleanest solution structure
- Flag any architectural concerns
Be precise and technical.`,

  Coder: `You are the Coder agent in a multi-agent AI engineering system. Your role is to:
- Take the architectural plan and write the actual implementation
- Produce production-ready code with proper types, error handling, and modularity
- Reference specific file paths and code patterns
- Prefer editing existing files over creating new ones unless necessary
- Use best practices for the detected tech stack
Output clean, working code with explanations.`,

  Security: `You are the Security agent in a multi-agent AI engineering system. Your role is to:
- Review the proposed code and plan for security vulnerabilities
- Check for: injection risks, auth bypass, data exposure, unsafe dependencies
- Rate overall safety: SAFE / CAUTION / UNSAFE
- Suggest fixes for any issues found
- Block dangerous operations (rm -rf, credential leaks, etc.)
Be thorough but practical.`,

  Reviewer: `You are the Reviewer agent in a multi-agent AI engineering system. Your role is to:
- Review the complete output from all previous agents
- Check for: code quality, edge cases, performance, readability
- Suggest specific improvements with reasoning
- Rate overall quality: EXCELLENT / GOOD / NEEDS_IMPROVEMENT
- Write a final summary of what was accomplished
Be constructive and specific.`,

  Debugger: `You are the Debugger agent in a multi-agent AI engineering system. Your role is to:
- Analyze errors or failures in the pipeline
- Identify root cause precisely
- Propose a targeted fix
- Verify the fix addresses the root cause without regressions
Be analytical and systematic.`,
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const TOOL_INSTRUCTIONS = `You may request a tool call only when it is necessary. To request a tool, output exactly one JSON object and no other text in this format: {"tool":"tool_name","args":{}}. Available tools are:`;

function toolCatalogText() {
  return listTools()
    .map((tool) => `${tool.name}: ${tool.description}. Safety: ${tool.safety}. Schema: ${JSON.stringify(tool.schema)}`)
    .join("\n");
}

function broadcastToClients(run: AgentRun, entry: LogEntry) {
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of run.sseClients) {
    try {
      client.write(payload);
    } catch {
    }
  }
}

function broadcastStatus(run: AgentRun) {
  const payload = `data: ${JSON.stringify({
    id: run.id,
    status: run.status,
    progress: run.progress,
    currentAgent: run.currentAgent,
    type: "__status__",
  })}\n\n`;
  for (const client of run.sseClients) {
    try {
      client.write(payload);
    } catch {
    }
  }
}

function addLog(
  run: AgentRun,
  agent: AgentName | "System",
  type: LogType,
  content: string,
): LogEntry {
  const entry: LogEntry = {
    id: randomUUID(),
    timestamp: Date.now(),
    agent,
    type,
    content,
  };
  run.logs.push(entry);
  broadcastToClients(run, entry);
  return entry;
}

async function runAgentOnce(
  run: AgentRun,
  agentName: AgentName,
  messages: ChatMessage[],
): Promise<string> {
  const signal = run.abortController.signal;
  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: `${AGENT_PERSONAS[agentName]}\n\n${TOOL_INSTRUCTIONS}\n${toolCatalogText()}` },
      ...messages,
    ],
    stream: true,
  });

  let buffer = "";
  let lastFlush = Date.now();

  for await (const chunk of stream) {
    if (signal.aborted) {
      stream.controller.abort();
      break;
    }
    const content = chunk.choices[0]?.delta?.content ?? "";
    if (content) {
      fullResponse += content;
      buffer += content;

      if (Date.now() - lastFlush > 150 || buffer.includes("\n")) {
        addLog(run, agentName, "output", buffer);
        buffer = "";
        lastFlush = Date.now();
      }
    }
  }

  if (buffer) {
    addLog(run, agentName, "output", buffer);
  }

  return fullResponse;
}

function parseToolCall(output: string): { tool: string; args: Record<string, unknown> } | null {
  const trimmed = output.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.tool === "string" &&
      parsed.args &&
      typeof parsed.args === "object" &&
      !Array.isArray(parsed.args)
    ) {
      return parsed as { tool: string; args: Record<string, unknown> };
    }
  } catch {
  }
  return null;
}

function artifactTypeForTool(toolName: string) {
  return toolName === "browser_navigate" ? "browser_output" : "result";
}

async function recordArtifact(
  run: AgentRun,
  step: string,
  type: string,
  content: unknown,
) {
  try {
    await storeArtifact({ userId: run.userId, runId: run.id, step, type, content });
  } catch {
    addLog(run, "System", "error", "Artifact storage failed.");
  }
}

async function runAgentWithTools(
  run: AgentRun,
  agentName: AgentName,
  messages: ChatMessage[],
): Promise<string> {
  const workingMessages = [...messages];
  let output = await runAgentOnce(run, agentName, workingMessages);

  for (let toolRound = 0; toolRound < 2; toolRound++) {
    const toolCall = parseToolCall(output);
    if (!toolCall) return output;

    addLog(run, "System", "action", `${agentName} requested tool: ${toolCall.tool}`);
    await recordArtifact(run, agentName.toLowerCase(), "tool_call", toolCall);

    try {
      const result = await executeTool(toolCall.tool, toolCall.args, {
        runId: run.id,
        agentName,
        confirmed: run.toolExecutionConfirmed,
        signal: run.abortController.signal,
      });
      const serialized = JSON.stringify(result);
      addLog(run, "System", "output", `Tool result (${toolCall.tool}): ${serialized.slice(0, 2000)}`);
      await recordArtifact(run, agentName.toLowerCase(), artifactTypeForTool(toolCall.tool), {
        tool: toolCall.tool,
        args: toolCall.args,
        result,
      });
      workingMessages.push({ role: "assistant", content: output });
      workingMessages.push({
        role: "user",
        content: `Tool result for ${toolCall.tool}: ${serialized}\nContinue your agent response using this result.`,
      });
      output = await runAgentOnce(run, agentName, workingMessages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(run, "System", "error", `Tool ${toolCall.tool} failed: ${msg}`);
      await recordArtifact(run, agentName.toLowerCase(), "tool_error", {
        tool: toolCall.tool,
        args: toolCall.args,
        error: msg,
      });
      workingMessages.push({ role: "assistant", content: output });
      workingMessages.push({
        role: "user",
        content: `Tool ${toolCall.tool} failed: ${msg}\nContinue without that tool and explain the limitation if relevant.`,
      });
      output = await runAgentOnce(run, agentName, workingMessages);
    }
  }

  return output;
}

async function runAgent(
  run: AgentRun,
  agentName: AgentName,
  messages: ChatMessage[],
): Promise<string> {
  run.currentAgent = agentName;
  run.updatedAt = Date.now();
  broadcastStatus(run);

  addLog(run, agentName, "thinking", `Starting analysis...`);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (run.abortController.signal.aborted) break;
    try {
      return await runAgentWithTools(run, agentName, messages);
    } catch (err) {
      lastErr = err;
      if (run.abortController.signal.aborted) break;
      if (attempt < 2) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(run, agentName, "error", `Attempt ${attempt} failed: ${msg}. Retrying...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`${agentName} agent failed after 2 attempts: ${msg}`);
}

export function createRun(
  userId: string,
  goal: string,
  options: { toolExecutionConfirmed?: boolean } = {},
): AgentRun {
  const id = randomUUID();
  const run: AgentRun = {
    id,
    userId,
    goal,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    logs: [],
    progress: 0,
    currentAgent: null,
    abortController: new AbortController(),
    sseClients: new Set(),
    toolExecutionConfirmed: options.toolExecutionConfirmed === true,
  };
  runs.set(id, run);
  return run;
}

export function getRun(userId: string, id: string): AgentRun | undefined {
  const run = runs.get(id);
  return run?.userId === userId ? run : undefined;
}

export function listRuns(userId: string): Omit<AgentRun, "sseClients" | "abortController">[] {
  return Array.from(runs.values())
    .filter((run) => run.userId === userId)
    .map(({ sseClients: _s, abortController: _a, ...rest }) => rest)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function stopRun(userId: string, id: string): boolean {
  const run = getRun(userId, id);
  if (!run) return false;
  run.abortController.abort();
  run.status = "stopped";
  run.updatedAt = Date.now();
  run.currentAgent = null;
  addLog(run, "System", "system", "Agent run stopped by user.");
  broadcastStatus(run);
  for (const client of run.sseClients) {
    try {
      client.write(`data: ${JSON.stringify({ type: "__done__" })}\n\n`);
      client.end();
    } catch {
    }
  }
  run.sseClients.clear();
  return true;
}

export function addSseClient(userId: string, id: string, res: Response): boolean {
  const run = getRun(userId, id);
  if (!run) return false;
  run.sseClients.add(res);
  res.on("close", () => {
    run.sseClients.delete(res);
  });
  for (const entry of run.logs) {
    try {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    } catch {
    }
  }
  const statusPayload = `data: ${JSON.stringify({
    id: run.id,
    status: run.status,
    progress: run.progress,
    currentAgent: run.currentAgent,
    type: "__status__",
  })}\n\n`;
  try {
    res.write(statusPayload);
  } catch {
  }
  return true;
}

const PROGRESS_MAP: Record<string, number> = {
  planner: 20,
  architect: 40,
  coder: 65,
  security: 80,
  reviewer: 100,
};

function detectAgentStatus(agentName: string, output: string): "success" | "fail" {
  const upper = output.toUpperCase();
  if (agentName === "security") {
    return upper.includes("UNSAFE") ? "fail" : "success";
  }
  if (agentName === "reviewer") {
    return upper.includes("NEEDS_IMPROVEMENT") ? "fail" : "success";
  }
  return "success";
}

export async function executeRun(runId: string): Promise<void> {
  const run = runs.get(runId);
  if (!run) return;

  run.status = "running";
  run.updatedAt = Date.now();
  broadcastStatus(run);

  addLog(run, "System", "system", `Starting multi-agent pipeline for goal: "${run.goal}"`);

  const makeAgent = (agentName: AgentName) =>
    async (input: string, context: { userInput: string; artifacts: Record<string, string> }) => {
      const messages: ChatMessage[] = [
        { role: "user", content: `Goal: ${context.userInput}` },
      ];

      const memory = await getRecentMemorySummary(run.userId);
      if (memory) {
        messages.push({ role: "user", content: `Recent run memory:\n${memory}` });
      }

      const order = ["planner", "architect", "coder", "security", "reviewer"];
      const currentIdx = order.indexOf(agentName.toLowerCase());
      for (let i = 0; i < currentIdx; i++) {
        const prevAgent = order[i] as AgentName;
        const prevCapitalized = (prevAgent.charAt(0).toUpperCase() + prevAgent.slice(1)) as AgentName;
        const artifact = context.artifacts[prevAgent];
        if (artifact) {
          messages.push({ role: "assistant", content: `[${prevCapitalized}]: ${artifact}` });
          messages.push({ role: "user", content: "Continue as the next agent in the pipeline." });
        }
      }

      addLog(run, "System", "action", `Handing off to ${agentName} agent...`);
      const output = await runAgent(run, agentName, messages);
      const status = detectAgentStatus(agentName.toLowerCase(), output);
      await recordArtifact(run, agentName.toLowerCase(), agentName.toLowerCase() === "coder" ? "code" : agentName.toLowerCase() === "planner" ? "plan" : "result", output);

      run.progress = PROGRESS_MAP[agentName.toLowerCase()] ?? run.progress;
      run.updatedAt = Date.now();
      broadcastStatus(run);
      addLog(run, "System", "action", `${agentName} agent completed (status: ${status}).`);

      return { output, status, metadata: { agentName } };
    };

  try {
    const result = await runPipeline({
      userInput: run.goal,
      signal: run.abortController.signal,
      agents: {
        planner:   makeAgent("Planner"),
        architect: makeAgent("Architect"),
        coder:     makeAgent("Coder"),
        security:  makeAgent("Security"),
        reviewer:  makeAgent("Reviewer"),
      },
      onEvent: (event: string, data: Record<string, unknown>) => {
        if (event === "transition") {
          addLog(run, "System", "action",
            `Routing: ${data.from} → ${data.to}${data.reason ? ` (${data.reason})` : ""}`);
        }
        if (event === "step" && (data.iteration as number) > 1) {
          addLog(run, "System", "system",
            `Re-running ${String(data.step)} (iteration ${data.iteration})`);
        }
      },
    });

    const statusCheck: string = run.status; // Reset type to string to avoid narrowing
    if (statusCheck !== "stopped") {
      const newStatus = result.status as RunStatus;
      run.status = newStatus;
      run.currentAgent = null;
      run.progress = newStatus === "completed" ? 100 : run.progress;
      run.updatedAt = Date.now();
      const msg = newStatus === "completed"
        ? "All agents completed. Pipeline finished successfully."
        : `Pipeline ended with status: ${newStatus}`;
      addLog(run, "System", "system", msg);
      broadcastStatus(run);
    }
  } catch (err) {
    const statusCheck: string = run.status; // Reset type to string to avoid narrowing
    if (statusCheck !== "stopped") {
      run.status = "failed" as RunStatus;
      run.currentAgent = null;
      run.updatedAt = Date.now();
      const msg = err instanceof Error ? err.message : String(err);
      addLog(run, "System", "error", `Pipeline failed: ${msg}`);
      broadcastStatus(run);
    }
  } finally {
    for (const client of run.sseClients) {
      try {
        client.write(`data: ${JSON.stringify({ type: "__done__" })}\n\n`);
        client.end();
      } catch {
      }
    }
    run.sseClients.clear();
  }
}
