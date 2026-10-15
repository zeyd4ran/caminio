import { Router, type IRouter, type Request, type RequestHandler } from "express";
import {
  createRun,
  executeRun,
  getRun,
  listRuns,
  stopRun,
  addSseClient,
} from "../services/agentOrchestrator";
import { getRecentArtifacts, getRecentRuns } from "../services/memoryService.js";
import { getParamAsString } from "../lib/queryNormalizer";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);
type AuthRequest = Request & { userId: string };
const getUserId = (req: Request): string =>
  (req as unknown as AuthRequest).userId;

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

router.post("/agents", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { goal, confirmed } = req.body as { goal?: string; confirmed?: boolean };
  if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  const run = createRun(userId, goal.trim(), { toolExecutionConfirmed: confirmed === true });
  executeRun(run.id).catch(() => {});

  res.status(201).json({
    id: run.id,
    goal: run.goal,
    status: run.status,
    createdAt: run.createdAt,
  });
}));

router.post("/agents/runs", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { goal, confirmed } = req.body as { goal?: string; confirmed?: boolean };
  if (!goal || typeof goal !== "string" || goal.trim().length === 0) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  const run = createRun(userId, goal.trim(), { toolExecutionConfirmed: confirmed === true });
  executeRun(run.id).catch(() => {});

  res.status(201).json({
    id: run.id,
    goal: run.goal,
    status: run.status,
    createdAt: run.createdAt,
  });
}));

router.get("/agents", (req, res): void => {
  const userId = getUserId(req);
  const all = listRuns(userId).map(({ logs: _l, userId: _u, ...rest }) => rest);
  res.json(all);
});

router.get("/agents/runs", (req, res): void => {
  const userId = getUserId(req);
  const all = listRuns(userId).map(({ logs: _l, userId: _u, ...rest }) => rest);
  res.json(all);
});

router.get("/agents/memory", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const artifacts = await getRecentArtifacts(userId);
  res.json({ runs: await getRecentRuns(userId), artifacts });
}));

router.get("/agents/:id", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const run = getRun(userId, getParamAsString(req.params.id));
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const { sseClients: _s, abortController: _a, userId: _u, ...safeRun } = run;
  res.json(safeRun);
}));

router.get("/agents/runs/:id", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const run = getRun(userId, getParamAsString(req.params.id));
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const { sseClients: _s, abortController: _a, userId: _u, ...safeRun } = run;
  res.json(safeRun);
}));

router.post("/agents/:id/stop", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const stopped = stopRun(userId, getParamAsString(req.params.id));
  if (!stopped) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ success: true });
}));

router.delete("/agents/runs/:id/stop", asyncRoute(async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const stopped = stopRun(userId, getParamAsString(req.params.id));
  if (!stopped) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  res.json({ success: true });
}));

router.get("/agents/:id/stream", (req, res): void => {
  const userId = getUserId(req);
  const run = getRun(userId, getParamAsString(req.params.id));
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const added = addSseClient(userId, run.id, res);
  if (!added) {
    res.end();
    return;
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "stopped") {
    res.write(`data: ${JSON.stringify({ type: "__done__" })}\n\n`);
    res.end();
  }
});

router.get("/agents/runs/:id/stream", (req, res): void => {
  const userId = getUserId(req);
  const run = getRun(userId, req.params.id);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const added = addSseClient(userId, run.id, res);
  if (!added) {
    res.end();
    return;
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "stopped") {
    res.write(`data: ${JSON.stringify({ type: "__done__" })}\n\n`);
    res.end();
  }
});

export default router;
