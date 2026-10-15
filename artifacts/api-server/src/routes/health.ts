import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { listRuns } from "../services/agentOrchestrator";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbOk = false;
  let dbError: string | undefined;

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  let agentsOk = false;
  let agentCount = 0;
  try {
    const runs = listRuns();
    agentCount = runs.length;
    agentsOk = true;
  } catch {
    agentsOk = false;
  }

  const allOk = dbOk && agentsOk;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    services: {
      api: true,
      database: dbOk,
      agents: agentsOk,
    },
    meta: {
      agentRunCount: agentCount,
      ...(dbError ? { dbError } : {}),
    },
  });
});

export default router;
