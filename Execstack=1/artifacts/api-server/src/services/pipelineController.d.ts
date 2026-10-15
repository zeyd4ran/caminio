export interface AgentExecutor {
  (input: string, context: any): Promise<{ output: string; status: "success" | "fail"; metadata?: any }>;
}

export interface PipelineOptions {
  userInput: string;
  agents: Record<string, AgentExecutor>;
  signal?: AbortSignal;
  onEvent?: (event: string, data: any) => void;
}

export interface PipelineResult {
  runId: string;
  status: string;
  finalOutput: string | null;
  history: any[];
}

export function runPipeline(options: PipelineOptions): Promise<PipelineResult>;
