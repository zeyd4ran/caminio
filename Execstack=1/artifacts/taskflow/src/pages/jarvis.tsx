import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  Play,
  Square,
  Terminal,
} from "lucide-react";
import type {
  JarvisAuditRecord,
  JarvisRunRequest,
  JarvisRunResult,
  JarvisSession,
  JarvisSessionSummary,
  JarvisStepResult,
} from "@workspace/api-client-react";
import {
  appendRunHistoryMessage,
  createRunConversation,
} from "@/lib/conversation-history";
import {
  getGetJarvisSessionQueryKey,
  getListJarvisSessionsQueryKey,
  getJarvisSession,
  listJarvisSessions,
  confirmJarvisAction,
  stopJarvisSession,
} from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
const MODEL_OPTIONS = ["llama3.1", "llama3.2", "qwen2.5"];
const STEP_OPTIONS = [5, 10, 25, 50];

type RunState =
  | "idle"
  | "loading"
  | "running"
  | "completed"
  | "stopped"
  | "error"
  | "ollama-unreachable";

interface StreamEvent {
  event: string;
  data: unknown;
}

interface PendingConfirmationEvent {
  sessionId: string;
  toolCall: { tool: string; input?: string | number; reason: string };
  currentUrl: string | null;
  reason: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

function readApiError(text: string): string {
  try {
    const body = JSON.parse(text) as { error?: string; message?: string };
    return body.error ?? body.message ?? "The request failed.";
  } catch {
    return text || "The request failed.";
  }
}

function parseSseFrame(frame: string): StreamEvent | null {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }

  if (data.length === 0) return null;

  try {
    return { event, data: JSON.parse(data.join("\n")) as unknown };
  } catch {
    return null;
  }
}

function StatusBadge({ state, selectedStatus }: { state: RunState; selectedStatus?: string }) {
  const status = selectedStatus ?? state;
  const display: Record<string, { label: string; className: string }> = {
    idle: { label: "Ready", className: "bg-muted text-muted-foreground" },
    loading: { label: "Starting", className: "bg-blue-500/15 text-blue-600" },
    running: { label: "Running", className: "bg-blue-500/15 text-blue-600" },
    completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-700" },
    stopped: { label: "Stopped", className: "bg-muted text-muted-foreground" },
    error: { label: "Error", className: "bg-destructive/15 text-destructive" },
    failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
    "ollama-unreachable": { label: "Ollama unavailable", className: "bg-amber-500/15 text-amber-700" },
  };
  const item = display[status] ?? display.idle;

  return <Badge className={item.className}>{item.label}</Badge>;
}

function StepLog({ steps, isRunning }: { steps: JarvisStepResult[]; isRunning: boolean }) {
  if (steps.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center text-center text-muted-foreground">
        {isRunning ? (
          <Loader2 className="mb-3 h-8 w-8 animate-spin" aria-hidden="true" />
        ) : (
          <Terminal className="mb-3 h-8 w-8 opacity-50" aria-hidden="true" />
        )}
        <p>{isRunning ? "Waiting for Jarvis’s first step…" : "Enter a goal and run Jarvis to see its steps here."}</p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={`${step.step}-${step.timestamp}`} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {step.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              )}
              <span className="font-medium">Step {step.step}: {step.toolCall.tool}</span>
            </div>
            <time className="text-xs text-muted-foreground">
              {new Date(step.timestamp).toLocaleTimeString()}
            </time>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{step.toolCall.reason}</p>
          {step.error && <p className="mt-2 whitespace-pre-wrap text-sm text-destructive">{step.error}</p>}
          {step.output && (
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 text-xs">
              {step.output}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}

function AuditLog({ entries }: { entries: JarvisAuditRecord[] }) {
  if (entries.length === 0) return null;

  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer font-medium">
        Tool audit log ({entries.length} records)
      </summary>
      <ol className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <li
            key={`${entry.step}-${entry.status}-${entry.timestamp}-${index}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-3 text-sm"
          >
            <span>
              Step {entry.step} · {entry.tool} · {entry.status}
              {entry.inputLength > 0 ? ` · ${entry.inputLength} input characters` : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              {entry.browserOrigin ?? "No browser page"} ·{" "}
              {new Date(entry.timestamp).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        Inputs are redacted; the audit records tool, outcome, timing, and page origin.
      </p>
    </details>
  );
}

function SessionHistory({
  sessions,
  isLoading,
  error,
  onSelect,
  selectedId,
}: {
  sessions: JarvisSessionSummary[];
  isLoading: boolean;
  error?: string;
  onSelect: (id: string) => void;
  selectedId: string;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading recent sessions…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">Your Jarvis sessions will appear here.</p>;
  }

  return (
    <ul className="space-y-2">
      {sessions.map((session) => (
        <li key={session.sessionId}>
          <button
            type="button"
            onClick={() => onSelect(session.sessionId)}
            className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${
              selectedId === session.sessionId ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="line-clamp-2 text-sm font-medium">{session.goal}</span>
              <StatusBadge state="idle" selectedStatus={session.status} />
            </div>
            <span className="mt-2 block text-xs text-muted-foreground">
              {session.steps} {session.steps === 1 ? "step" : "steps"} ·{" "}
              {new Date(session.startedAt).toLocaleString()}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function JarvisPage() {
  const [goal, setGoal] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0]);
  const [maxSteps, setMaxSteps] = useState("25");
  const [runState, setRunState] = useState<RunState>("idle");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [steps, setSteps] = useState<JarvisStepResult[]>([]);
  const [auditEntries, setAuditEntries] = useState<JarvisAuditRecord[]>([]);
  const [result, setResult] = useState<JarvisRunResult | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmationEvent | null>(null);
  const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
  const [runError, setRunError] = useState("");
  const [historyWarning, setHistoryWarning] = useState("");
  const [stopRequested, setStopRequested] = useState(false);
  const queryClient = useQueryClient();
  const isRunning = runState === "running" || runState === "loading";

  const sessionsQuery = useQuery({
    queryKey: getListJarvisSessionsQueryKey(),
    queryFn: () => listJarvisSessions(),
    refetchInterval: isRunning ? 2500 : false,
  });
  const selectedSessionQuery = useQuery({
    queryKey: getGetJarvisSessionQueryKey(selectedSessionId),
    queryFn: () => getJarvisSession(selectedSessionId),
    enabled: Boolean(selectedSessionId),
  });

  const displayedSteps = useMemo(() => {
    if (selectedSessionId) return selectedSessionQuery.data?.steps ?? [];
    return steps;
  }, [selectedSessionId, selectedSessionQuery.data, steps]);

  const displayedSession: JarvisSession | null = selectedSessionQuery.data ?? null;
  const displayedResult = selectedSessionId ? null : result;
  const displayedAudit = selectedSessionId
    ? (displayedSession?.auditLog ?? [])
    : (displayedResult?.auditLog ?? auditEntries);
  const isBusy = isRunning;

  async function handleRun() {
    const cleanGoal = goal.trim();
    if (!cleanGoal || isBusy) return;

    setRunState("loading");
    setActiveSessionId("");
    setSelectedSessionId("");
    setSteps([]);
    setAuditEntries([]);
    setResult(null);
    setPendingConfirmation(null);
    setConfirmationSubmitting(false);
    setRunError("");
    setHistoryWarning("");
    setStopRequested(false);
    let historyConversationId: number | null = null;
    let historySaved = false;
    let receivedTerminalEvent = false;

    const persistHistoryResult = async (content: string) => {
      if (historyConversationId === null || historySaved) return;
      historySaved = true;
      try {
        await appendRunHistoryMessage(historyConversationId, "assistant", content);
      } catch {
        setHistoryWarning("The Jarvis run finished, but its transcript could not be saved. Check sign-in and the API connection.");
      }
    };

    const request: JarvisRunRequest = {
      goal: cleanGoal,
      model,
      maxSteps: Number(maxSteps),
    };

    try {
      try {
        historyConversationId = await createRunConversation(cleanGoal, "jarvis");
        await appendRunHistoryMessage(historyConversationId, "user", cleanGoal);
      } catch {
        setHistoryWarning("Jarvis will run, but this run could not be saved. Sign in and check the API connection to use history.");
      }

      const response = await apiFetch(`${API_BASE}/jarvis/run/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(readApiError(await response.text()));
      }
      if (!response.body) {
        throw new Error("The server did not return a progress stream.");
      }

      setRunState("running");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleFrame = (frame: string) => {
        const parsed = parseSseFrame(frame);
        if (!parsed) return;

        if (parsed.event === "started") {
          const data = parsed.data as { sessionId?: string };
          if (data.sessionId) setActiveSessionId(data.sessionId);
          return;
        }
        if (parsed.event === "audit") {
          setAuditEntries((current) => [
            ...current,
            parsed.data as JarvisAuditRecord,
          ]);
          return;
        }
        if (parsed.event === "confirmation_required") {
          setPendingConfirmation(parsed.data as PendingConfirmationEvent);
          return;
        }
        if (parsed.event === "step") {
          setSteps((current) => [...current, parsed.data as JarvisStepResult]);
          return;
        }
        if (parsed.event === "done") {
          receivedTerminalEvent = true;
          const data = parsed.data as {
            status: JarvisRunResult["status"];
            result: JarvisRunResult;
          };
          setResult(data.result);
          setSteps(data.result.steps);
          setAuditEntries(data.result.auditLog);
          setPendingConfirmation(null);
          setRunState(
            data.status === "completed"
              ? "completed"
              : data.status === "stopped"
                ? "stopped"
                : "error",
          );
          if (data.status === "failed") {
            setRunError("Jarvis ended without completing the goal. Review the step log for details.");
          }
          const stepTranscript = data.result.steps.map((step) => [
            `Step ${step.step}: ${step.toolCall.tool}`,
            `Reason: ${step.toolCall.reason}`,
            step.output ? `Output: ${step.output}` : "",
            step.error ? `Error: ${step.error}` : "",
          ].filter(Boolean).join("\n")).join("\n\n");
          void persistHistoryResult(
            `Jarvis run status: ${data.status}\n\n${stepTranscript || "No steps were recorded."}`,
          );
          setStopRequested(false);
          void queryClient.invalidateQueries({ queryKey: getListJarvisSessionsQueryKey() });
          return;
        }
        if (parsed.event === "error") {
          receivedTerminalEvent = true;
          const data = parsed.data as { sessionId?: string; error?: string };
          setPendingConfirmation(null);
          const message = data.error ?? "Jarvis could not complete the run.";
          setRunError(message);
          setRunState(/ollama/i.test(message) ? "ollama-unreachable" : "error");
          setStopRequested(false);
          if (data.sessionId) setActiveSessionId(data.sessionId);
          void persistHistoryResult(`Jarvis run error: ${message}`);
          void queryClient.invalidateQueries({ queryKey: getListJarvisSessionsQueryKey() });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) handleFrame(frame);
      }

      buffer += decoder.decode();
      if (buffer.trim()) handleFrame(buffer);
      if (!receivedTerminalEvent) {
        throw new Error("Jarvis ended the stream before returning a final result.");
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setRunError(message);
      setRunState(/ollama/i.test(message) ? "ollama-unreachable" : "error");
      setStopRequested(false);
      setPendingConfirmation(null);
      void persistHistoryResult(`Jarvis run error: ${message}`);
    } finally {
      void queryClient.invalidateQueries({ queryKey: getListJarvisSessionsQueryKey() });
    }
  }

  async function respondToConfirmation(approved: boolean) {
    if (!pendingConfirmation || confirmationSubmitting) return;
    setConfirmationSubmitting(true);
    try {
      await confirmJarvisAction(pendingConfirmation.sessionId, { approved });
      setPendingConfirmation(null);
    } catch (error) {
      setRunError(getErrorMessage(error));
      setPendingConfirmation(null);
    } finally {
      setConfirmationSubmitting(false);
    }
  }

  async function handleStop() {
    if (!activeSessionId || !isRunning || stopRequested) return;

    try {
      await stopJarvisSession(activeSessionId);
      setStopRequested(true);
      setPendingConfirmation(null);
    } catch (error) {
      setRunError(getErrorMessage(error));
      setRunState("error");
    }
  }

  function selectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setActiveSessionId("");
    setRunState("idle");
    setRunError("");
    setResult(null);
    setPendingConfirmation(null);
  }

  const selectedStatus = displayedSession?.status;
  const visibleState = selectedSessionId
    ? (selectedStatus ?? "loading")
    : runState;
  const finalOutput = displayedResult?.steps.at(-1)?.output
    ?? displayedSession?.steps.at(-1)?.output
    ?? "";

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Cpu className="h-8 w-8 text-primary" />
            Jarvis
          </h1>
          <p className="mt-1 text-muted-foreground">
            A local Ollama browser agent that works through goals one step at a time.
          </p>
        </div>
        <StatusBadge state={visibleState as RunState} selectedStatus={selectedSessionId ? selectedStatus : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run a goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="jarvis-goal" className="text-sm font-medium">Goal</label>
                <Textarea
                  id="jarvis-goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Describe the task Jarvis should complete…"
                  maxLength={2000}
                  className="min-h-32 resize-y"
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground">{goal.length}/2000 characters</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label htmlFor="jarvis-model" className="text-sm font-medium">Ollama model</label>
                  <Select value={model} onValueChange={setModel} disabled={isBusy}>
                    <SelectTrigger id="jarvis-model" aria-label="Ollama model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="jarvis-max-steps" className="text-sm font-medium">Max steps</label>
                  <Select value={maxSteps} onValueChange={setMaxSteps} disabled={isBusy}>
                    <SelectTrigger id="jarvis-max-steps" aria-label="Maximum steps">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_OPTIONS.map((count) => (
                        <SelectItem key={count} value={String(count)}>{count} steps</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleRun}
                  disabled={!goal.trim() || isBusy}
                >
                  {runState === "loading" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  disabled={!isRunning || !activeSessionId || stopRequested}
                >
                  {stopRequested ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  {stopRequested ? "Stopping" : "Stop"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ollama must be running where the API server can reach it, with the selected model already pulled.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4" />
                Recent sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SessionHistory
                sessions={sessionsQuery.data ?? []}
                isLoading={sessionsQuery.isLoading}
                error={sessionsQuery.isError ? getErrorMessage(sessionsQuery.error) : undefined}
                onSelect={selectSession}
                selectedId={selectedSessionId}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {runError && (
            <div
              role="alert"
              className={`rounded-lg border p-4 ${
                runState === "ollama-unreachable"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-800"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                {runState === "ollama-unreachable" ? "Ollama isn’t reachable" : "Run error"}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{runError}</p>
            </div>
          )}

          {historyWarning && (
            <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
              {historyWarning}
            </p>
          )}

          {stopRequested && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
              Stop requested. Jarvis will finish its current step, then stop.
            </p>
          )}

          {pendingConfirmation && (
            <section
              role="region"
              aria-live="assertive"
              aria-label="Risky action confirmation"
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
            >
              <h2 className="font-semibold">Jarvis needs your approval</h2>
              <p className="mt-2 text-sm">{pendingConfirmation.reason}</p>
              <p className="mt-2 text-sm">
                Action: <span className="font-medium">{pendingConfirmation.toolCall.tool}</span>
                {pendingConfirmation.currentUrl && (
                  <> · Page: {new URL(pendingConfirmation.currentUrl).origin}</>
                )}
              </p>
              {pendingConfirmation.toolCall.tool === "type_text" && (
                <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-sm">
                  {String(pendingConfirmation.toolCall.input ?? "")}
                </pre>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => void respondToConfirmation(true)}
                  disabled={confirmationSubmitting}
                >
                  Approve this action once
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void respondToConfirmation(false)}
                  disabled={confirmationSubmitting}
                >
                  Deny
                </Button>
              </div>
            </section>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{selectedSessionId ? "Session steps" : "Live step log"}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {displayedSteps.length} {displayedSteps.length === 1 ? "step" : "steps"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSessionId && selectedSessionQuery.isLoading ? (
                <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading session…
                </div>
              ) : selectedSessionId && selectedSessionQuery.isError ? (
                <p className="py-8 text-sm text-destructive">
                  {getErrorMessage(selectedSessionQuery.error)}
                </p>
              ) : (
                <StepLog steps={displayedSteps} isRunning={isRunning} />
              )}
            </CardContent>
          </Card>

          <AuditLog entries={displayedAudit} />

          {(displayedResult || displayedSession) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Final result</span>
                  <StatusBadge
                    state="idle"
                    selectedStatus={displayedResult?.status ?? displayedSession?.status}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm font-medium">
                  {displayedResult?.goal ?? displayedSession?.goal}
                </p>
                {finalOutput ? (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 p-4 text-sm">
                    {finalOutput}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {displayedResult?.status === "completed" || displayedSession?.status === "completed"
                      ? "Jarvis completed the goal without a text output."
                      : "No final output was recorded for this session."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
