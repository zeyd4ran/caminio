import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const agentArtifactsTable = pgTable("agent_artifacts", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull(),
  step: text("step").notNull(),
  type: text("type").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentArtifact = typeof agentArtifactsTable.$inferSelect;