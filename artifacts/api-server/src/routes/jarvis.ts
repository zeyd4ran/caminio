import { Router } from "express";
import {
  runJarvis,
  getSession,
  getAllSessions,
  stopSession,
} from "@workspace/jarvis-core";
import type { ToolConfirmationRequest } from "@workspace/jarvis-core";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
router.use(requireAuth);
const ConfirmationSchema = z.object({
  approved: z.boolean(),
});

interface PendingConfirmation {
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

function resolvePendingConfirmation(
  sessionId: string,
  approved: boolean,
): boolean {
  const pending = pendingConfirmations.get(sessionId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  pendingConfirmations.delete(sessionId);
  pending.resolve(approved);
  return true;
}

function waitForConfirmation(
  request: ToolConfirmationRequest,
  send: (event: string, data: unknown) => void,
  timeoutMs: number,
): Promise<boolean> {
  resolvePendingConfirmation(request.sessionId, false);

  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolvePendingConfirmation(request.sessionId, false),
      timeoutMs,
    );
    pendingConfirmations.set(request.sessionId, { resolve, timer });
    send("confirmation_required", request);
  });
}

const RunSchema = z.object({
  goal: z.string().min(1).max(2000),
  model: z.string().optional().default("llama3.1"),
  maxSteps: z.number().int().min(1).max(50).optional().default(25),
  stepTimeoutMs: z
    .number()
    .int()
    .min(5_000)
    .max(120_000)
    .optional()
    .default(60_000),
  ollamaUrl: z.string().url().optional().default("http://localhost:11434"),
});

router.post("/jarvis/run", async (req, res) => {
  const parsed = RunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  try {
    const result = await runJarvis(parsed.data);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/jarvis/run/stream", async (req, res) => {
  const parsed = RunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const sessionId = randomUUID();
  res.on("close", () => {
    resolvePendingConfirmation(sessionId, false);
  });
  res.flushHeaders();
  send("started", { sessionId });

  try {
    const result = await runJarvis({
      ...parsed.data,
      sessionId,
      onStep: (step) => send("step", step),
      onAudit: (record) => send("audit", record),
      onConfirmationRequired: (request) =>
        waitForConfirmation(request, send, parsed.data.stepTimeoutMs),
    });

    send("done", { sessionId: result.sessionId, status: result.status, result });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { sessionId, error: message });
    res.end();
  }
});

router.get("/jarvis/sessions", (_req, res) => {
  const sessions = getAllSessions().map((s) => ({
    sessionId: s.sessionId,
    goal: s.goal,
    status: s.status,
    steps: s.steps.length,
    failureCount: s.failureCount,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
  }));
  res.json(sessions);
});

router.get("/jarvis/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.post("/jarvis/sessions/:id/stop", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  resolvePendingConfirmation(req.params.id, false);
  stopSession(req.params.id);
  res.json({ stopped: true, sessionId: req.params.id });
});

router.post("/jarvis/sessions/:id/confirm", (req, res) => {
  const id = req.params.id;
  const parsed = ConfirmationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid confirmation request" });
    return;
  }

  if (!resolvePendingConfirmation(id, parsed.data.approved)) {
    res.status(409).json({ error: "No confirmation is pending for this session." });
    return;
  }

  res.json({ sessionId: id, approved: parsed.data.approved });
});

export default router;
