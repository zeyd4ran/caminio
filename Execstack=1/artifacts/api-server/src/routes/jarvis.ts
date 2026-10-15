import { Router } from "express";
import {
  runJarvis,
  getSessionForUser,
  getAllSessionsForUser,
  stopSession,
} from "@workspace/jarvis-core";
import type { ToolConfirmationRequest } from "@workspace/jarvis-core";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
router.use(requireAuth);
type AuthRequest = Request & { userId: string };
const getUserId = (req: Request): string =>
  (req as unknown as AuthRequest).userId;
const ConfirmationSchema = z.object({
  approved: z.boolean(),
});

interface PendingConfirmation {
  userId: string;
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

function resolvePendingConfirmation(
  userId: string,
  sessionId: string,
  approved: boolean,
): boolean {
  const pending = pendingConfirmations.get(sessionId);
  if (!pending || pending.userId !== userId) return false;
  clearTimeout(pending.timer);
  pendingConfirmations.delete(sessionId);
  pending.resolve(approved);
  return true;
}

function waitForConfirmation(
  userId: string,
  request: ToolConfirmationRequest,
  send: (event: string, data: unknown) => void,
  timeoutMs: number,
): Promise<boolean> {
  resolvePendingConfirmation(userId, request.sessionId, false);

  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolvePendingConfirmation(userId, request.sessionId, false),
      timeoutMs,
    );
    pendingConfirmations.set(request.sessionId, { userId, resolve, timer });
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
  const userId = getUserId(req);
  const parsed = RunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
    return;
  }

  try {
    const result = await runJarvis({ ...parsed.data, userId });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post("/jarvis/run/stream", async (req, res) => {
  const userId = getUserId(req);
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
    resolvePendingConfirmation(userId, sessionId, false);
  });
  res.flushHeaders();
  send("started", { sessionId });

  try {
    const result = await runJarvis({
      ...parsed.data,
      userId,
      sessionId,
      onStep: (step) => send("step", step),
      onAudit: (record) => send("audit", record),
      onConfirmationRequired: (request) =>
        waitForConfirmation(userId, request, send, parsed.data.stepTimeoutMs),
    });

    send("done", { sessionId: result.sessionId, status: result.status, result });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { sessionId, error: message });
    res.end();
  }
});

router.get("/jarvis/sessions", (req, res) => {
  const userId = getUserId(req);
  const sessions = getAllSessionsForUser(userId).map((s) => ({
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
  const userId = getUserId(req);
  const session = getSessionForUser(userId, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.post("/jarvis/sessions/:id/stop", (req, res) => {
  const userId = getUserId(req);
  const session = getSessionForUser(userId, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  resolvePendingConfirmation(userId, req.params.id, false);
  stopSession(userId, req.params.id);
  res.json({ stopped: true, sessionId: req.params.id });
});

router.post("/jarvis/sessions/:id/confirm", (req, res) => {
  const userId = getUserId(req);
  const id = req.params.id;
  if (!getSessionForUser(userId, id)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const parsed = ConfirmationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid confirmation request" });
    return;
  }

  if (!resolvePendingConfirmation(userId, id, parsed.data.approved)) {
    res.status(409).json({ error: "No confirmation is pending for this session." });
    return;
  }

  res.json({ sessionId: id, approved: parsed.data.approved });
});

export default router;
