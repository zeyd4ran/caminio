export type ToolName =
  | "browser_navigate"
  | "browser_extract_dom"
  | "browser_click"
  | "type_text"
  | "open_app"
  | "wait"
  | "get_system_state";

export interface ToolCall {
  tool: ToolName;
  input?: string | number;
  reason: string;
}

export interface StepResult {
  step: number;
  toolCall: ToolCall;
  output: string;
  success: boolean;
  error?: string;
  timestamp: string;
}

export type ToolAuditStatus =
  | "confirmation_requested"
  | "approved"
  | "denied"
  | "blocked"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "completed";

export interface ToolAuditRecord {
  step: number;
  tool: ToolName;
  status: ToolAuditStatus;
  inputLength: number;
  browserOrigin?: string;
  timestamp: string;
}

export interface ToolConfirmationRequest {
  sessionId: string;
  toolCall: ToolCall;
  currentUrl: string | null;
  reason: string;
}

export interface AgentMemory {
  sessionId: string;
  goal: string;
  steps: StepResult[];
  auditLog: ToolAuditRecord[];
  failureCount: number;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "stopped";
}

export interface JarvisRunOptions {
  goal: string;
  sessionId?: string;
  maxSteps?: number;
  model?: string;
  stepTimeoutMs?: number;
  ollamaUrl?: string;
  onStep?: (step: StepResult) => void;
  onAudit?: (record: ToolAuditRecord) => void;
  onConfirmationRequired?: (
    request: ToolConfirmationRequest,
  ) => Promise<boolean>;
}

export interface JarvisRunResult {
  sessionId: string;
  goal: string;
  steps: StepResult[];
  auditLog: ToolAuditRecord[];
  status: AgentMemory["status"];
  completedAt: string;
}
