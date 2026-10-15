import { useState, useEffect, useRef, useCallback } from "react";
import Layout from "@/components/layout";
import { apiFetch } from "@/lib/api-fetch";
import {
  appendRunHistoryMessage,
  createRunConversation,
  formatAgentRunTranscript,
} from "@/lib/conversation-history";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Square,
  Loader2,
  Bot,
  Cpu,
  Code2,
  ShieldCheck,
  ClipboardCheck,
  Bug,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Terminal,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = `${BASE_URL}/api`;

type AgentName = "Planner" | "Architect" | "Coder" | "Security" | "Reviewer" | "Debugger" | "System";
type LogType = "thinking" | "output" | "action" | "error" | "system";
type RunStatus = "queued" | "running" | "completed" | "stopped" | "failed";

interface LogEntry {
  id: string;
  timestamp: number;
  agent: AgentName;
  type: LogType;
  content: string;
}

interface RunSummary {
  id: string;
  goal: string;
  status: RunStatus;
  progress: number;
  currentAgent: AgentName | null;
  createdAt: number;
}

const AGENT_ICONS: Record<AgentName, React.ElementType> = {
  Planner: Bot,
  Architect: Cpu,
  Coder: Code2,
  Security: ShieldCheck,
  Reviewer: ClipboardCheck,
  Debugger: Bug,
  System: Terminal,
};

const AGENT_COLORS: Record<AgentName, string> = {
  Planner: "text-blue-500",
  Architect: "text-purple-500",
  Coder: "text-green-500",
  Security: "text-orange-500",
  Reviewer: "text-cyan-500",
  Debugger: "text-red-500",
  System: "text-muted-foreground",
};

const AGENT_BG: Record<AgentName, string> = {
  Planner: "bg-blue-500/10 border-blue-500/20",
  Architect: "bg-purple-500/10 border-purple-500/20",
  Coder: "bg-green-500/10 border-green-500/20",
  Security: "bg-orange-500/10 border-orange-500/20",
  Reviewer: "bg-cyan-500/10 border-cyan-500/20",
  Debugger: "bg-red-500/10 border-red-500/20",
  System: "bg-muted/30 border-border",
};

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; icon: React.ElementType }> = {
  queued: { label: "Queued", color: "bg-muted text-muted-foreground", icon: Clock },
  running: { label: "Running", color: "bg-blue-500/20 text-blue-500", icon: Loader2 },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-600", icon: CheckCircle2 },
  stopped: { label: "Stopped", color: "bg-muted text-muted-foreground", icon: Square },
  failed: { label: "Failed", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
};

const PIPELINE_AGENTS: AgentName[] = ["Planner", "Architect", "Coder", "Security", "Reviewer"];

function AgentPipelineStep({ name, isCurrent, isDone }: { name: AgentName; isCurrent: boolean; isDone: boolean }) {
  const Icon = AGENT_ICONS[name];
  return (
    <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${isCurrent ? "scale-110" : ""}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
        isCurrent ? "border-primary bg-primary/20 shadow-lg shadow-primary/30" :
        isDone ? "border-green-500 bg-green-500/20" :
        "border-border bg-muted/30"
      }`}>
        {isCurrent ? (
          <Loader2 className={`h-5 w-5 animate-spin ${AGENT_COLORS[name]}`} />
        ) : (
          <Icon className={`h-5 w-5 ${isDone ? "text-green-500" : "text-muted-foreground"}`} />
        )}
      </div>
      <span className={`text-xs font-medium ${isCurrent ? AGENT_COLORS[name] : isDone ? "text-green-500" : "text-muted-foreground"}`}>
        {name}
      </span>
    </div>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const Icon = AGENT_ICONS[entry.agent] ?? Terminal;
  const color = AGENT_COLORS[entry.agent] ?? "text-muted-foreground";
  const bg = AGENT_BG[entry.agent] ?? "bg-muted/30 border-border";

  if (entry.type === "thinking") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground italic py-0.5">
        <Loader2 className={`h-3 w-3 animate-spin shrink-0 ${color}`} />
        <span className={color}>[{entry.agent}]</span>
        <span>{entry.content}</span>
      </div>
    );
  }

  if (entry.type === "action") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
        <Zap className="h-3 w-3 shrink-0 text-yellow-500" />
        <span>{entry.content}</span>
      </div>
    );
  }

  if (entry.type === "system") {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">{entry.content}</span>
      </div>
    );
  }

  if (entry.type === "error") {
    return (
      <div className={`rounded-md border p-2 my-1 bg-red-500/10 border-red-500/20`}>
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          <span className="text-xs font-semibold text-red-500">{entry.agent}</span>
        </div>
        <p className="text-xs text-red-400 whitespace-pre-wrap">{entry.content}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-md border p-2 my-1 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className={`text-xs font-semibold ${color}`}>{entry.agent}</span>
      </div>
      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{entry.content}</p>
    </div>
  );
}

export default function AgentPage() {
  const [goal, setGoal] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [currentRun, setCurrentRun] = useState<RunSummary | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunSummary[]>([]);
  const [historyWarning, setHistoryWarning] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  useEffect(() => {
    fetchRecentRuns();
  }, []);

  async function fetchRecentRuns() {
    try {
      const res = await apiFetch(`${API_BASE}/agents`);
      if (res.ok) {
        const data = await res.json() as RunSummary[];
        setRecentRuns(data.slice(0, 5));
      }
    } catch {
    }
  }

  function connectToStream(runId: string, historyConversationId: number | null) {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/agents/${runId}/stream`, {
      withCredentials: true,
    });
    eventSourceRef.current = es;
    let historySaved = false;

    const persistRunHistory = async () => {
      if (historySaved || historyConversationId === null) return;
      historySaved = true;

      try {
        const response = await apiFetch(`${API_BASE}/agents/${runId}`);
        if (!response.ok) throw new Error("Could not load the completed Agent Lab run.");
        const run = await response.json() as RunSummary & { logs: LogEntry[] };
        await appendRunHistoryMessage(
          historyConversationId,
          "assistant",
          formatAgentRunTranscript(run),
        );
      } catch {
        setHistoryWarning("The run finished, but its transcript could not be saved. Check sign-in and the API connection.");
      }
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === "__done__") {
          es.close();
          fetchRecentRuns();
          void persistRunHistory();
          return;
        }
        if (data.type === "__status__") {
          setCurrentRun((prev) => prev ? {
            ...prev,
            status: data.status as RunStatus,
            progress: data.progress as number,
            currentAgent: data.currentAgent as AgentName | null,
          } : prev);
          return;
        }
        setLogs((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.agent === data.agent &&
            last.type === "output" &&
            data.type === "output"
          ) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + data.content },
            ];
          }
          return [...prev, data as LogEntry];
        });
      } catch {
      }
    };

    es.onerror = () => {
      es.close();
      void apiFetch(`${API_BASE}/agents`).catch(() => undefined);
      void persistRunHistory();
    };
  }

  async function startRun() {
    if (!goal.trim() || isStarting) return;
    setIsStarting(true);
    setLogs([]);
    setHistoryWarning("");
    const cleanGoal = goal.trim();
    let historyConversationId: number | null = null;

    try {
      try {
        historyConversationId = await createRunConversation(cleanGoal, "agent_lab");
        await appendRunHistoryMessage(historyConversationId, "user", cleanGoal);
      } catch {
        setHistoryWarning("This run will continue, but it could not be saved. Sign in and check the API connection to use history.");
      }

      const res = await apiFetch(`${API_BASE}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cleanGoal }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to start agent");
      }

      const run = await res.json() as RunSummary;
      setCurrentRun({ ...run, progress: 0, currentAgent: null });
      connectToStream(run.id, historyConversationId);
      setGoal("");
      fetchRecentRuns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setLogs([{
        id: "err",
        timestamp: Date.now(),
        agent: "System",
        type: "error",
        content: `Failed to start: ${msg}`,
      }]);
      if (historyConversationId !== null) {
        void appendRunHistoryMessage(
          historyConversationId,
          "assistant",
          `Agent Lab could not start the run: ${msg}`,
        ).catch(() => {
          setHistoryWarning("The failed run could not be saved to conversation history.");
        });
      }
    } finally {
      setIsStarting(false);
    }
  }

  async function stopRun() {
    if (!currentRun || isStopping) return;
    setIsStopping(true);
    try {
      await apiFetch(`${API_BASE}/agents/${currentRun.id}/stop`, { method: "POST" });
    } finally {
      setIsStopping(false);
    }
  }

  function loadPreviousRun(runId: string) {
    setLogs([]);
    setIsStarting(false);
    apiFetch(`${API_BASE}/agents/${runId}`)
      .then((r) => r.json())
      .then((data: RunSummary & { logs: LogEntry[] }) => {
        setCurrentRun({
          id: data.id,
          goal: data.goal,
          status: data.status,
          progress: data.progress,
          currentAgent: data.currentAgent,
          createdAt: data.createdAt,
        });
        setLogs(data.logs ?? []);
      })
      .catch(() => {});
  }

  const isRunning = currentRun?.status === "running" || currentRun?.status === "queued";
  const currentPipelineIndex = currentRun?.currentAgent
    ? PIPELINE_AGENTS.indexOf(currentRun.currentAgent as AgentName)
    : -1;

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            Agent Lab
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-agent AI system — Planner, Architect, Coder, Security, Reviewer
          </p>
        </div>
      </div>

      {historyWarning && (
        <p role="status" className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
          {historyWarning}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                New Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Describe what you want the agent to build, fix, or analyze..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="min-h-[120px] text-sm resize-none"
                disabled={isRunning}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    startRun();
                  }
                }}
              />
              <div className="flex gap-2">
                {isRunning ? (
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={stopRun}
                    disabled={isStopping}
                  >
                    {isStopping ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Square className="h-4 w-4 mr-2" />
                    )}
                    Stop Agent
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={startRun}
                    disabled={!goal.trim() || isStarting}
                  >
                    {isStarting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Run Agents
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ctrl+Enter to start
              </p>
            </CardContent>
          </Card>

          {currentRun && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Current Run
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    {(() => {
                      const cfg = STATUS_CONFIG[currentRun.status];
                      const Icon = cfg.icon;
                      return (
                        <Badge className={`text-xs ${cfg.color} border-0`}>
                          <Icon className={`h-3 w-3 mr-1 ${currentRun.status === "running" ? "animate-spin" : ""}`} />
                          {cfg.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-foreground line-clamp-2">{currentRun.goal}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{currentRun.progress}%</span>
                  </div>
                  <Progress value={currentRun.progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between gap-1 pt-1">
                  {PIPELINE_AGENTS.map((agent, i) => (
                    <AgentPipelineStep
                      key={agent}
                      name={agent}
                      isCurrent={currentRun.currentAgent === agent}
                      isDone={
                        currentPipelineIndex > i ||
                        (currentRun.status === "completed")
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recentRuns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Runs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentRuns.map((run) => {
                  const cfg = STATUS_CONFIG[run.status];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={run.id}
                      className="w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors border border-border"
                      onClick={() => loadPreviousRun(run.id)}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <Badge className={`text-xs ${cfg.color} border-0`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-foreground line-clamp-1">{run.goal}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col min-h-[500px]">
            <CardHeader className="pb-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Agent Output
                </CardTitle>
                {logs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setLogs([])}
                    disabled={isRunning}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-0.5 font-mono">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-sm">
                    Enter a goal and click <strong>Run Agents</strong> to start the pipeline
                  </p>
                  <p className="text-muted-foreground/60 text-xs mt-2">
                    5 specialized AI agents will work together to achieve your goal
                  </p>
                </div>
              ) : (
                <>
                  {logs.map((entry) => (
                    <LogEntryRow key={entry.id} entry={entry} />
                  ))}
                  <div ref={logsEndRef} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
