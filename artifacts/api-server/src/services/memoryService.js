import { pool } from "@workspace/db";

const MAX_RUNS = 5;
const recentRuns = [];
let initPromise = null;

function ensureTable() {
  if (!initPromise) {
    initPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS agent_artifacts (
        id SERIAL PRIMARY KEY,
        run_id TEXT NOT NULL,
        step TEXT NOT NULL,
        type TEXT NOT NULL,
        content JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }
  return initPromise;
}

async function storeArtifact({ runId, step, type, content }) {
  await ensureTable();
  const result = await pool.query(
    "INSERT INTO agent_artifacts (run_id, step, type, content) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, run_id, step, type, content, created_at",
    [runId, step, type, JSON.stringify(content)],
  );
  return result.rows[0];
}

function rememberRun(run) {
  const safeRun = {
    id: run.id,
    goal: run.goal,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    progress: run.progress,
  };
  const existing = recentRuns.findIndex((item) => item.id === run.id);
  if (existing >= 0) recentRuns.splice(existing, 1);
  recentRuns.unshift(safeRun);
  if (recentRuns.length > MAX_RUNS) recentRuns.splice(MAX_RUNS);
  return safeRun;
}

function getRecentRuns() {
  return [...recentRuns];
}

async function getRecentArtifacts(limit = 25) {
  await ensureTable();
  const result = await pool.query(
    "SELECT id, run_id, step, type, content, created_at FROM agent_artifacts ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return result.rows;
}

function getRecentMemorySummary() {
  if (recentRuns.length === 0) return "";
  return recentRuns
    .map((run) => `${run.id}: ${run.status} — ${run.goal}`)
    .join("\n");
}

export { storeArtifact, rememberRun, getRecentRuns, getRecentArtifacts, getRecentMemorySummary };