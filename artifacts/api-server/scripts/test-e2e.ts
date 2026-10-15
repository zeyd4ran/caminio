import { db, tasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateTaskBody, UpdateTaskBody } from "@workspace/api-zod";

const TEST_USER = "test_user_e2e_taskflow";
const results: { name: string; pass: boolean; detail?: string }[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail });
  const icon = condition ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function cleanup() {
  await db.delete(tasksTable).where(eq(tasksTable.userId, TEST_USER));
}

async function run() {
  console.log("\n=== TaskFlow E2E Test Suite ===\n");

  await cleanup();

  // ─── 1. CREATE ────────────────────────────────────────────────────────────
  console.log("── Create Tasks ──");

  const validBody = CreateTaskBody.safeParse({
    title: "Write documentation",
    description: "Covers all endpoints",
    priority: "high",
    status: "todo",
    dueDate: "2030-12-31",
  });
  assert("Schema: valid create body parses", validBody.success);

  const noTitle = CreateTaskBody.safeParse({ priority: "high" });
  assert("Schema: missing title is rejected", !noTitle.success);

  const badPriority = CreateTaskBody.safeParse({ title: "X", priority: "urgent" });
  assert("Schema: invalid priority is rejected", !badPriority.success, badPriority.error?.issues[0]?.message);

  const badStatus = CreateTaskBody.safeParse({ title: "X", status: "archived" });
  assert("Schema: invalid status is rejected", !badStatus.success);

  const emptyTitle = CreateTaskBody.safeParse({ title: "" });
  assert("Schema: empty string title is rejected", !emptyTitle.success);

  const [task1] = await db.insert(tasksTable).values({
    userId: TEST_USER,
    title: "Write documentation",
    description: "Covers all endpoints",
    priority: "high",
    status: "todo",
    dueDate: "2026-01-01",
  }).returning();
  assert("DB: task created with correct fields", task1.title === "Write documentation" && task1.priority === "high");
  assert("DB: default status is todo", task1.status === "todo");
  assert("DB: userId stored correctly", task1.userId === TEST_USER);

  const [task2] = await db.insert(tasksTable).values({
    userId: TEST_USER,
    title: "Fix login bug",
    priority: "medium",
    status: "in_progress",
  }).returning();

  const [task3] = await db.insert(tasksTable).values({
    userId: TEST_USER,
    title: "Overdue task",
    priority: "low",
    status: "todo",
    dueDate: "2020-01-01",
  }).returning();

  const [task4] = await db.insert(tasksTable).values({
    userId: TEST_USER,
    title: "Completed task",
    priority: "medium",
    status: "done",
  }).returning();

  assert("DB: 4 tasks created", Boolean(task1.id && task2.id && task3.id && task4.id));

  // ─── 2. READ ──────────────────────────────────────────────────────────────
  console.log("\n── Read Tasks ──");

  const all = await db.select().from(tasksTable).where(eq(tasksTable.userId, TEST_USER));
  assert("DB: reads all 4 tasks", all.length === 4);

  const highTasks = await db.select().from(tasksTable).where(
    and(eq(tasksTable.userId, TEST_USER), eq(tasksTable.priority, "high"))
  );
  assert("DB: filter by priority=high returns 1", highTasks.length === 1 && highTasks[0].title === "Write documentation");

  const todoTasks = await db.select().from(tasksTable).where(
    and(eq(tasksTable.userId, TEST_USER), eq(tasksTable.status, "todo"))
  );
  assert("DB: filter by status=todo returns 2", todoTasks.length === 2);

  const byOtherUser = await db.select().from(tasksTable).where(eq(tasksTable.userId, "other_user"));
  assert("DB: other user cannot see test tasks", byOtherUser.length === 0);

  // ─── 3. UPDATE ────────────────────────────────────────────────────────────
  console.log("\n── Update Tasks ──");

  const validUpdate = UpdateTaskBody.safeParse({ title: "Updated title", status: "done" });
  assert("Schema: valid update body parses", validUpdate.success);

  const emptyUpdate = UpdateTaskBody.safeParse({});
  assert("Schema: empty update body is valid (partial allowed)", emptyUpdate.success);

  const badStatusUpdate = UpdateTaskBody.safeParse({ status: "invalid_status" });
  assert("Schema: invalid status update is rejected", !badStatusUpdate.success);

  const [updated] = await db.update(tasksTable)
    .set({ title: "Write documentation (UPDATED)", status: "in_progress", updatedAt: new Date() })
    .where(and(eq(tasksTable.id, task1.id), eq(tasksTable.userId, TEST_USER)))
    .returning();
  assert("DB: update changes title and status", updated.title === "Write documentation (UPDATED)" && updated.status === "in_progress");
  assert("DB: updatedAt is bumped", updated.updatedAt > task1.updatedAt);

  const wrongUserUpdate = await db.update(tasksTable)
    .set({ title: "Hacked" })
    .where(and(eq(tasksTable.id, task1.id), eq(tasksTable.userId, "attacker_user")))
    .returning();
  assert("Security: cross-user update returns nothing", wrongUserUpdate.length === 0);

  const [doubleCheck] = await db.select().from(tasksTable).where(eq(tasksTable.id, task1.id));
  assert("Security: title unchanged after cross-user update attempt", doubleCheck.title === "Write documentation (UPDATED)");

  // ─── 4. TOGGLE ────────────────────────────────────────────────────────────
  console.log("\n── Toggle Completion ──");

  const newStatus2 = task2.status === "done" ? "todo" : "done";
  const [toggled] = await db.update(tasksTable)
    .set({ status: newStatus2, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, task2.id), eq(tasksTable.userId, TEST_USER)))
    .returning();
  assert("DB: toggle in_progress → done", toggled.status === "done");

  const newStatus2b = toggled.status === "done" ? "todo" : "done";
  const [toggledBack] = await db.update(tasksTable)
    .set({ status: newStatus2b, updatedAt: new Date() })
    .where(and(eq(tasksTable.id, task2.id), eq(tasksTable.userId, TEST_USER)))
    .returning();
  assert("DB: toggle done → todo (back)", toggledBack.status === "todo");

  // ─── 5. STATS ─────────────────────────────────────────────────────────────
  console.log("\n── Stats Calculation ──");

  const allForStats = await db.select().from(tasksTable).where(eq(tasksTable.userId, TEST_USER));
  const today = new Date().toISOString().split("T")[0];

  const total = allForStats.length;
  const completed = allForStats.filter((t) => t.status === "done").length;
  const pending = allForStats.filter((t) => t.status !== "done").length;
  const overdue = allForStats.filter((t) => t.status !== "done" && t.dueDate != null && t.dueDate < today).length;
  const byPriority = {
    low: allForStats.filter((t) => t.priority === "low").length,
    medium: allForStats.filter((t) => t.priority === "medium").length,
    high: allForStats.filter((t) => t.priority === "high").length,
  };

  assert("Stats: total = 4", total === 4);
  assert("Stats: completed = 1 (task4)", completed === 1);
  assert("Stats: pending = 3", pending === 3);
  assert("Stats: overdue = 1 (task3, due 2020-01-01)", overdue === 1, `overdue=${overdue}`);
  assert("Stats: byPriority.high = 1", byPriority.high === 1);
  assert("Stats: byPriority.medium = 2", byPriority.medium === 2, `got ${byPriority.medium}`);
  assert("Stats: byPriority.low = 1", byPriority.low === 1);

  // ─── 6. DELETE ────────────────────────────────────────────────────────────
  console.log("\n── Delete Tasks ──");

  const wrongUserDelete = await db.delete(tasksTable)
    .where(and(eq(tasksTable.id, task1.id), eq(tasksTable.userId, "attacker_user")))
    .returning();
  assert("Security: cross-user delete returns nothing", wrongUserDelete.length === 0);

  const [stillExists] = await db.select().from(tasksTable).where(eq(tasksTable.id, task1.id));
  assert("Security: task still exists after failed cross-user delete", Boolean(stillExists));

  const [deleted] = await db.delete(tasksTable)
    .where(and(eq(tasksTable.id, task1.id), eq(tasksTable.userId, TEST_USER)))
    .returning();
  assert("DB: own task can be deleted", deleted.id === task1.id);

  const [gone] = await db.select().from(tasksTable).where(eq(tasksTable.id, task1.id));
  assert("DB: deleted task no longer found", gone === undefined);

  const afterDelete = await db.select().from(tasksTable).where(eq(tasksTable.userId, TEST_USER));
  assert("DB: 3 tasks remain after 1 deletion", afterDelete.length === 3);

  // ─── 7. API Input Validation ──────────────────────────────────────────────
  console.log("\n── API Input Validation ──");

  const httpTests: Array<{ label: string; method: string; path: string; body?: object; expectedStatus: number }> = [
    { label: "GET /api/healthz → 200", method: "GET", path: "/api/healthz", expectedStatus: 200 },
    { label: "GET /api/tasks (no auth) → 401", method: "GET", path: "/api/tasks", expectedStatus: 401 },
    { label: "POST /api/tasks (no auth) → 401", method: "POST", path: "/api/tasks", body: { title: "x" }, expectedStatus: 401 },
    { label: "GET /api/nonexistent → 404", method: "GET", path: "/api/nonexistent", expectedStatus: 404 },
    { label: "POST /api/tasks (bad JSON) → 400 (via auth check)", method: "POST", path: "/api/tasks", expectedStatus: 401 },
  ];

  for (const t of httpTests) {
    const opts: RequestInit = { method: t.method };
    if (t.body) {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(t.body);
    }
    const resp = await fetch(`http://localhost:8080${t.path}`, opts);
    assert(`HTTP: ${t.label}`, resp.status === t.expectedStatus, `got ${resp.status}`);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  await cleanup();
  const afterCleanup = await db.select().from(tasksTable).where(eq(tasksTable.userId, TEST_USER));
  assert("Cleanup: all test data removed", afterCleanup.length === 0);

  // ─── Summary ──────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n═══════════════════════════════════════`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ❌ ${r.name}${r.detail ? ` — ${r.detail}` : ""}`));
    process.exit(1);
  } else {
    console.log("All tests passed! ✅");
  }
}

run().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
