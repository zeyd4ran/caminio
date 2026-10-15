import { and, desc, eq, sql } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

export type TaskFilters = {
  status?: TaskStatus;
  priority?: TaskPriority;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

type TaskRecord = typeof tasksTable.$inferSelect;

export function toApiTask(task: TaskRecord) {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function toApiTasks(tasks: TaskRecord[]) {
  return tasks.map(toApiTask);
}

function taskOwnerCondition(userId: string, taskId?: number) {
  const conditions = [eq(tasksTable.userId, userId)];
  if (taskId != null) conditions.push(eq(tasksTable.id, taskId));
  return and(...conditions);
}

export async function listTasks(userId: string, filters: TaskFilters) {
  const conditions = [eq(tasksTable.userId, userId)];
  if (filters.status) conditions.push(eq(tasksTable.status, filters.status));
  if (filters.priority) conditions.push(eq(tasksTable.priority, filters.priority));

  return db
    .select()
    .from(tasksTable)
    .where(and(...conditions))
    .orderBy(desc(tasksTable.createdAt));
}

export async function getTaskStats(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [summary] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasksTable.status} = 'done')::int`,
      pending: sql<number>`count(*) filter (where ${tasksTable.status} <> 'done')::int`,
      overdue: sql<number>`count(*) filter (where ${tasksTable.status} <> 'done' and ${tasksTable.dueDate} is not null and ${tasksTable.dueDate} < ${today})::int`,
      low: sql<number>`count(*) filter (where ${tasksTable.priority} = 'low')::int`,
      medium: sql<number>`count(*) filter (where ${tasksTable.priority} = 'medium')::int`,
      high: sql<number>`count(*) filter (where ${tasksTable.priority} = 'high')::int`,
    })
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId));

  const recentlyCompleted = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, userId), eq(tasksTable.status, "done")))
    .orderBy(desc(tasksTable.updatedAt))
    .limit(5);

  return {
    total: Number(summary?.total ?? 0),
    completed: Number(summary?.completed ?? 0),
    pending: Number(summary?.pending ?? 0),
    overdue: Number(summary?.overdue ?? 0),
    byPriority: {
      low: Number(summary?.low ?? 0),
      medium: Number(summary?.medium ?? 0),
      high: Number(summary?.high ?? 0),
    },
    recentlyCompleted: toApiTasks(recentlyCompleted),
  };
}

export async function createTask(userId: string, input: CreateTaskInput) {
  const [task] = await db.insert(tasksTable).values({ ...input, userId }).returning();
  return task;
}

export async function getTask(userId: string, taskId: number) {
  const [task] = await db.select().from(tasksTable).where(taskOwnerCondition(userId, taskId));
  return task ?? null;
}

export async function updateTask(userId: string, taskId: number, input: UpdateTaskInput) {
  const [task] = await db
    .update(tasksTable)
    .set({ ...input, updatedAt: new Date() })
    .where(taskOwnerCondition(userId, taskId))
    .returning();
  return task ?? null;
}

export async function deleteTask(userId: string, taskId: number) {
  const [task] = await db.delete(tasksTable).where(taskOwnerCondition(userId, taskId)).returning();
  return task ?? null;
}

export async function toggleTaskComplete(userId: string, taskId: number) {
  const existing = await getTask(userId, taskId);
  if (!existing) return null;

  const [updated] = await db
    .update(tasksTable)
    .set({
      status: existing.status === "done" ? "todo" : "done",
      updatedAt: new Date(),
    })
    .where(taskOwnerCondition(userId, taskId))
    .returning();

  return updated ?? null;
}