export interface RunData {
  id: string;
  goal: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  progress: number;
}

export interface Artifact {
  id: number;
  run_id: string;
  step: string;
  type: string;
  content: any;
  created_at: string;
}

export function storeArtifact(data: { runId: string; step: string; type: string; content: any }): Promise<Artifact>;
export function rememberRun(run: RunData): RunData;
export function getRecentRuns(): RunData[];
export function getRecentArtifacts(limit?: number): Promise<Artifact[]>;
export function getRecentMemorySummary(): string;
