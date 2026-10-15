import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: text("due_date"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  userId: text("user_id").notNull(),
  source: text("source").notNull().default("agent_lab"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentArtifactsTable = pgTable("agent_artifacts", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull(),
  // Nullable only to preserve pre-ownership artifacts; new writes always set the owner.
  userId: text("user_id"),
  step: text("step").notNull(),
  type: text("type").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("agent_artifacts_user_created_idx").on(table.userId, table.createdAt),
]);

export const agentRunsTable = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  goal: text("goal").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  progress: integer("progress").notNull().default(0),
  currentAgent: text("current_agent"),
  logs: jsonb("logs").$type<Record<string, unknown>[]>().notNull().default([]),
}, (table) => [
  index("agent_runs_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const jarvisSessionsTable = pgTable("jarvis_sessions", {
  sessionId: text("session_id").primaryKey(),
  userId: text("user_id").notNull(),
  goal: text("goal").notNull(),
  status: text("status").notNull(),
  steps: jsonb("steps").$type<Record<string, unknown>[]>().notNull().default([]),
  auditLog: jsonb("audit_log").$type<Record<string, unknown>[]>().notNull().default([]),
  failureCount: integer("failure_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("jarvis_sessions_user_started_idx").on(table.userId, table.startedAt),
]);

export type AgentArtifact = typeof agentArtifactsTable.$inferSelect;
