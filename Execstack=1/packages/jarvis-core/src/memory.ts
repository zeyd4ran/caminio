import { randomUUID } from "node:crypto";
import type { AgentMemory, StepResult, ToolAuditRecord } from "./types.js";

const sessions = new Map<string, AgentMemory>();

export function createSession(
  goal: string,
  sessionId?: string,
  userId = "",
): AgentMemory {
  const id = sessionId ?? randomUUID();
  const memory: AgentMemory = {
    sessionId: id,
    userId,
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

export function getSessionForUser(
  userId: string,
  sessionId: string,
): AgentMemory | undefined {
  const session = sessions.get(sessionId);
  return session?.userId === userId ? session : undefined;
}

export function getAllSessionsForUser(userId: string): AgentMemory[] {
  return Array.from(sessions.values()).filter(
    (session) => session.userId === userId,
  );
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

export function stopSession(userId: string, sessionId: string): boolean {
  const memory = getSessionForUser(userId, sessionId);
  if (!memory) return false;
  if (memory.status === "running") {
    memory.status = "stopped";
    memory.completedAt = new Date().toISOString();
  }
  return true;
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
