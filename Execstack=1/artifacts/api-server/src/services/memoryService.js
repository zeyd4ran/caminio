import { pool } from "@workspace/db";

async function storeArtifact({ userId, runId, step, type, content }) {
  const result = await pool.query(
    "INSERT INTO agent_artifacts (user_id, run_id, step, type, content) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, user_id, run_id, step, type, content, created_at",
    [userId, runId, step, type, JSON.stringify(content)],
  );
  return result.rows[0];
}

async function getRecentRuns(userId, limit = 5) {
  const result = await pool.query(
    `SELECT id, goal, status, created_at AS "createdAt",
            updated_at AS "updatedAt", progress
       FROM agent_runs
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map((run) => ({
    ...run,
    createdAt: new Date(run.createdAt).getTime(),
    updatedAt: new Date(run.updatedAt).getTime(),
  }));
}

async function getRecentArtifacts(userId, limit = 25) {
  const result = await pool.query(
    `SELECT id, user_id, run_id, step, type, content, created_at
       FROM agent_artifacts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

async function getRecentMemorySummary(userId) {
  const result = await pool.query(
    `SELECT id, status, goal
       FROM agent_runs
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 5`,
    [userId],
  );
  return result.rows
    .map((run) => `${run.id}: ${run.status} — ${run.goal}`)
    .join("\n");
}

export { storeArtifact, getRecentRuns, getRecentArtifacts, getRecentMemorySummary };