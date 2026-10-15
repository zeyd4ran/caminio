import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const API_BASE = "http://127.0.0.1:8080/api";
const userId = `vitest-${randomUUID()}`;

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

interface SseReaderState {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
  buffer: string;
  queuedFrames: string[];
}

async function nextSseEvent(state: SseReaderState): Promise<SseEvent> {
  while (true) {
    while (state.queuedFrames.length > 0) {
      const frame = state.queuedFrames.shift() ?? "";
      let event = "message";
      const data: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (data.length > 0) {
        return { event, data: JSON.parse(data.join("\n")) as Record<string, unknown> };
      }
    }

    const { done, value } = await state.reader.read();
    if (done) throw new Error("Jarvis SSE stream closed before the expected event.");
    state.buffer += state.decoder.decode(value, { stream: true });
    const frames = state.buffer.split(/\r?\n\r?\n/);
    state.buffer = frames.pop() ?? "";
    state.queuedFrames.push(...frames);
  }
}

async function request(
  path: string,
  options: RequestInit = {},
  includeTestUser = true,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (includeTestUser) headers.set("x-test-user-id", userId);

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(15_000),
  });
}

describe("API integration", () => {
  let createdTaskId: number | undefined;

  beforeAll(async () => {
    let health: Response;
    try {
      health = await request("/healthz", {}, false);
    } catch {
      throw new Error(
        "Start the API Server workflow on port 8080 before running pnpm test.",
      );
    }
    if (!health.ok) {
      throw new Error(
        `The local API health check failed with HTTP ${health.status}.`,
      );
    }
  });

  afterAll(async () => {
    if (createdTaskId !== undefined) {
      await request(`/tasks/${createdTaskId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
    }
  });

  it("protects task routes and supports create, list, ownership checks, and delete", async () => {
    const unauthorized = await request("/tasks", {}, false);
    expect(unauthorized.status).toBe(401);

    const created = await request("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: "Vitest API task",
        description: "Temporary integration-test row",
        priority: "low",
      }),
    });
    expect(created.status).toBe(201);
    const task = (await created.json()) as { id: number; title: string };
    createdTaskId = task.id;
    expect(task.title).toBe("Vitest API task");

    const listed = await request("/tasks");
    expect(listed.status).toBe(200);
    const tasks = (await listed.json()) as Array<{ id: number }>;
    expect(tasks.some((item) => item.id === task.id)).toBe(true);

    const otherUser = await fetch(`${API_BASE}/tasks/${task.id}`, {
      headers: {
        "x-test-user-id": `${userId}-other`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    expect(otherUser.status).toBe(404);

    const deleted = await request(`/tasks/${task.id}`, { method: "DELETE" });
    expect(deleted.status).toBe(204);
    createdTaskId = undefined;
  });

  it("serves Jarvis session and run endpoints with the development test-user header", async () => {
    const sessions = await request("/jarvis/sessions");
    expect(sessions.status).toBe(200);
    expect(Array.isArray(await sessions.json())).toBe(true);

    const noPendingConfirmation = await request(
      "/jarvis/sessions/no-pending-confirmation/confirm",
      {
        method: "POST",
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(noPendingConfirmation.status).toBe(409);

    const run = await request("/jarvis/run", {
      method: "POST",
      body: JSON.stringify({
        goal: "Check an unavailable local model service",
        model: "llama3.1",
        maxSteps: 1,
        stepTimeoutMs: 5_000,
        ollamaUrl: "http://127.0.0.1:9",
      }),
    });
    expect(run.status).toBe(500);
    expect(JSON.stringify(await run.json())).toContain("Ollama is not reachable");

    const stream = await request("/jarvis/run/stream", {
      method: "POST",
      headers: { accept: "text/event-stream" },
      body: JSON.stringify({
        goal: "Check the Jarvis SSE error path",
        maxSteps: 1,
        stepTimeoutMs: 5_000,
        ollamaUrl: "http://127.0.0.1:9",
      }),
    });
    expect(stream.status).toBe(200);
    const events = await stream.text();
    expect(events).toContain("event: started");
    expect(events).toContain("event: error");
    expect(events).toContain("Ollama is not reachable");
  });

  it("pauses a risky stream action until the client confirms or denies it", async () => {
    let generation = 0;
    const ollamaServer = createServer((incoming, outgoing) => {
      incoming.resume();
      outgoing.setHeader("content-type", "application/json");
      if (incoming.method === "GET" && incoming.url === "/api/tags") {
        outgoing.end(JSON.stringify({ models: [] }));
        return;
      }
      if (incoming.method === "POST" && incoming.url === "/api/generate") {
        const response =
          generation++ === 0
            ? {
                tool: "type_text",
                input: "safe test text",
                reason: "Enter the requested test value",
              }
            : {
                tool: "get_system_state",
                input: "",
                reason: "TASK_COMPLETE",
              };
        outgoing.end(JSON.stringify({ response: JSON.stringify(response), done: true }));
        return;
      }
      outgoing.statusCode = 404;
      outgoing.end(JSON.stringify({ error: "not found" }));
    });

    await new Promise<void>((resolve) => {
      ollamaServer.listen(0, "127.0.0.1", resolve);
    });
    const address = ollamaServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not start the local Ollama test stub.");
    }

    try {
      const stream = await request("/jarvis/run/stream", {
        method: "POST",
        headers: { accept: "text/event-stream" },
        body: JSON.stringify({
          goal: "Test risky-action confirmation",
          maxSteps: 3,
          stepTimeoutMs: 5_000,
          ollamaUrl: `http://127.0.0.1:${address.port}`,
        }),
      });
      expect(stream.status).toBe(200);
      if (!stream.body) throw new Error("The server returned no SSE body.");

      const state: SseReaderState = {
        reader: stream.body.getReader(),
        decoder: new TextDecoder(),
        buffer: "",
        queuedFrames: [],
      };
      let confirmation: SseEvent | undefined;
      while (!confirmation) {
        const event = await nextSseEvent(state);
        if (event.event === "confirmation_required") confirmation = event;
      }

      const sessionId = String(confirmation.data.sessionId);
      expect((confirmation.data.toolCall as { tool?: string }).tool).toBe("type_text");

      const denied = await request(`/jarvis/sessions/${sessionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ approved: false }),
      });
      expect(denied.status).toBe(200);
      expect((await denied.json()).approved).toBe(false);

      let done: SseEvent | undefined;
      while (!done) {
        const event = await nextSseEvent(state);
        if (event.event === "done") done = event;
      }
      const result = done.data.result as {
        status: string;
        auditLog: Array<{ status: string }>;
        steps: Array<{ success: boolean }>;
      };
      expect(result.status).toBe("completed");
      expect(result.steps[0]?.success).toBe(false);
      expect(result.auditLog.map((entry) => entry.status)).toContain("denied");
    } finally {
      await new Promise<void>((resolve, reject) => {
        ollamaServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
