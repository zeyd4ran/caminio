import { randomUUID } from "node:crypto";
import type { AgentMemory, StepResult, ToolAuditRecord } from "./types.js";

const sessions = new Map<string, AgentMemory>();

export function createSession(goal: string, sessionId?: string): AgentMemory {
  const id = sessionId ?? randomUUID();
  const memory: AgentMemory = {
    sessionId: id,
    goal,
    steps: [],
    auditLog: [],
    failureCount: 0,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  sessions.set(id, memory);
  return memory;
}

export function getSession(sessionId: string): AgentMemory | undefined {
  return sessions.get(sessionId);
}

export function getAllSessions(): AgentMemory[] {
  return Array.from(sessions.values());
}

export function addStep(sessionId: string, step: StepResult): void {
  const memory = sessions.get(sessionId);
  if (!memory) throw new Error(`Session not found: ${sessionId}`);
  memory.steps.push(step);
  if (!step.success) memory.failureCount++;
}

export function addAuditRecord(
  sessionId: string,
  record: ToolAuditRecord,
): void {
  const memory = sessions.get(sessionId);
  if (!memory) throw new Error(`Session not found: ${sessionId}`);
  memory.auditLog.push(record);
}

export function completeSession(
  sessionId: string,
  status: AgentMemory["status"],
): void {
  const memory = sessions.get(sessionId);
  if (!memory) return;
  memory.status = status;
  memory.completedAt = new Date().toISOString();
}

export function stopSession(sessionId: string): void {
  const memory = sessions.get(sessionId);
  if (memory && memory.status === "running") {
    memory.status = "stopped";
    memory.completedAt = new Date().toISOString();
  }
}

export function clearOldSessions(maxAgeMs = 3_600_000): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [id, mem] of sessions.entries()) {
    if (
      new Date(mem.startedAt).getTime() < cutoff &&
      mem.status !== "running"
    ) {
      sessions.delete(id);
    }
  }
}
