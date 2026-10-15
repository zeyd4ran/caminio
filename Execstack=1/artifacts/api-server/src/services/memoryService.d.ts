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
  user_id: string | null;
  run_id: string;
  step: string;
  type: string;
  content: any;
  created_at: Date | string;
}

export function storeArtifact(data: { userId: string; runId: string; step: string; type: string; content: any }): Promise<Artifact>;
export function getRecentRuns(userId: string, limit?: number): Promise<RunData[]>;
export function getRecentArtifacts(userId: string, limit?: number): Promise<Artifact[]>;
export function getRecentMemorySummary(userId: string): Promise<string>;
