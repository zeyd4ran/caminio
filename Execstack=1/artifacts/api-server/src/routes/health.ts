import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

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

  const allOk = dbOk;

  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    services: {
      api: true,
      database: dbOk,
      agents: true,
    },
    meta: {
      ...(dbError ? { dbError } : {}),
    },
  });
});

export default router;
