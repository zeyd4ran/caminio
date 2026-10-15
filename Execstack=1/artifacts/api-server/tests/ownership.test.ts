import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  pool: { query: mocks.query },
}));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));
vi.mock("../src/services/pipelineController.js", () => ({
  runPipeline: vi.fn(),
}));
vi.mock("../src/services/toolRegistry.js", () => ({
  executeTool: vi.fn(),
  listTools: vi.fn(() => []),
}));
vi.mock("../src/services/tools/browserTool.js", () => ({}));
vi.mock("../src/services/memoryService.js", () => ({
  getRecentMemorySummary: vi.fn(async () => ""),
  storeArtifact: vi.fn(),
  getRecentArtifacts: vi.fn(async () => []),
  getRecentRuns: vi.fn(async () => []),
}));

import {
  addSseClient,
  createRun,
  getRun,
  listRuns,
  stopRun,
} from "../src/services/agentOrchestrator";
import {
  createSession,
  getAllSessionsForUser,
  getSessionForUser,
  stopSession,
} from "../../../packages/jarvis-core/src/memory.js";

describe("per-user agent and Jarvis ownership", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("prevents one user from listing, getting, stopping, or streaming another user's run", () => {
    const runA = createRun("user-a", "User A's private goal");
    const runB = createRun("user-b", "User B's private goal");

    expect(listRuns("user-a").map((run) => run.id)).toContain(runA.id);
    expect(listRuns("user-a").map((run) => run.id)).not.toContain(runB.id);
    expect(getRun("user-a", runB.id)).toBeUndefined();
    expect(stopRun("user-a", runB.id)).toBe(false);
    expect(getRun("user-b", runB.id)?.status).toBe("queued");

    const stream = { write: vi.fn(), on: vi.fn() };
    expect(addSseClient("user-a", runB.id, stream as never)).toBe(false);
  });

  it("prevents one user from listing, getting, or stopping another user's Jarvis session", () => {
    const sessionA = createSession("A goal", "session-a", "user-a");
    const sessionB = createSession("B goal", "session-b", "user-b");

    expect(getAllSessionsForUser("user-a").map((item) => item.sessionId)).toEqual([
      sessionA.sessionId,
    ]);
    expect(getSessionForUser("user-a", sessionB.sessionId)).toBeUndefined();
    expect(stopSession("user-a", sessionB.sessionId)).toBe(false);
    expect(getSessionForUser("user-b", sessionB.sessionId)?.status).toBe("running");
  });
});
