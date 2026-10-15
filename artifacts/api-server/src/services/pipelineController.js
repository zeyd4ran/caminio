/**
 * Pipeline Controller (Workflow Engine)
 * Plain JavaScript — no TypeScript, no external dependencies.
 *
 * Execution order: planner → architect → coder → security → reviewer
 * Conditional transitions:
 *   - security fails  → back to coder
 *   - reviewer rejects → back to coder
 *   - reviewer approves → completed
 * Loop protection: max 10 iterations per step before aborting.
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

const AGENT_ORDER = ["planner", "architect", "coder", "security", "reviewer"];
const MAX_ITERATIONS_PER_STEP = 10;

/**
 * Determine the next step based on the current step and its result.
 * @param {string} step
 * @param {{ status: "success" | "fail" }} result
 * @returns {string} next step name or "completed"
 */
function getNextStep(step, result) {
  if (step === "security") {
    return result.status === "success" ? "reviewer" : "coder";
  }
  if (step === "reviewer") {
    return result.status === "success" ? "completed" : "coder";
  }
  const idx = AGENT_ORDER.indexOf(step);
  return idx >= 0 && idx < AGENT_ORDER.length - 1
    ? AGENT_ORDER[idx + 1]
    : "completed";
}

/**
 * Run the full multi-agent pipeline.
 *
 * @param {{
 *   userInput: string,
 *   agents: Record<string, (input: string, context: object) => Promise<{ output: string, status: "success"|"fail", metadata?: object }>>,
 *   signal?: AbortSignal,
 *   onEvent?: (event: string, data: object) => void
 * }} options
 *
 * @returns {Promise<{ runId: string, status: string, finalOutput: string|null, history: object[] }>}
 */
async function runPipeline({ userInput, agents, signal, onEvent }) {
  const emitter = new EventEmitter();

  const state = {
    runId: randomUUID(),
    currentStep: null,
    status: "running",
    context: {
      userInput,
      artifacts: {},
    },
    history: [],
  };

  const emit = (event, data) => {
    if (onEvent) onEvent(event, data);
    emitter.emit(event, data);
  };

  const iterationCounts = {};
  let currentStep = AGENT_ORDER[0];

  try {
    while (currentStep !== "completed" && state.status === "running") {
      if (signal?.aborted) {
        state.status = "stopped";
        console.log("[Pipeline] Aborted by signal.");
        break;
      }

      iterationCounts[currentStep] = (iterationCounts[currentStep] || 0) + 1;

      if (iterationCounts[currentStep] > MAX_ITERATIONS_PER_STEP) {
        const reason = `Max iterations (${MAX_ITERATIONS_PER_STEP}) exceeded for step: ${currentStep}`;
        console.log(`[Pipeline] ${reason}`);
        state.status = "failed";
        state.history.push({
          step: currentStep,
          input: null,
          output: null,
          status: "fail",
          error: reason,
          timestamp: Date.now(),
        });
        emit("error", { step: currentStep, reason });
        break;
      }

      state.currentStep = currentStep;
      console.log(`[Pipeline] Step: ${currentStep} (iteration ${iterationCounts[currentStep]})`);
      emit("step", {
        step: currentStep,
        iteration: iterationCounts[currentStep],
        runId: state.runId,
      });

      const agentFn = agents[currentStep];
      if (!agentFn) {
        throw new Error(`No agent registered for step: "${currentStep}"`);
      }

      const previousOutput =
        AGENT_ORDER.slice(0, AGENT_ORDER.indexOf(currentStep))
          .reduceRight((found, s) => found ?? state.context.artifacts[s], null) ??
        userInput;

      let result;
      try {
        result = await agentFn(previousOutput, state.context);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(`[Pipeline] Error in step "${currentStep}": ${errorMsg}`);

        state.history.push({
          step: currentStep,
          input: previousOutput,
          output: null,
          status: "fail",
          error: errorMsg,
          timestamp: Date.now(),
        });

        emit("agentError", { step: currentStep, error: errorMsg, runId: state.runId });

        const earlyStage = currentStep === "planner" || currentStep === "architect";
        const coderLooped = (iterationCounts["coder"] || 0) >= MAX_ITERATIONS_PER_STEP;

        if (earlyStage || coderLooped) {
          state.status = "failed";
          emit("error", { step: currentStep, reason: errorMsg, runId: state.runId });
          break;
        }

        console.log(`[Pipeline] Transition: ${currentStep} → coder (error recovery)`);
        emit("transition", { from: currentStep, to: "coder", reason: "error", runId: state.runId });
        currentStep = "coder";
        continue;
      }

      state.context.artifacts[currentStep] = result.output;

      state.history.push({
        step: currentStep,
        input: previousOutput,
        output: result.output,
        status: result.status,
        metadata: result.metadata ?? {},
        timestamp: Date.now(),
      });

      emit("agentComplete", {
        step: currentStep,
        status: result.status,
        output: result.output,
        metadata: result.metadata ?? {},
        runId: state.runId,
      });

      const nextStep = getNextStep(currentStep, result);

      if (nextStep !== "completed") {
        console.log(`[Pipeline] Transition: ${currentStep} → ${nextStep}`);
        emit("transition", { from: currentStep, to: nextStep, runId: state.runId });
      } else {
        console.log(`[Pipeline] Transition: ${currentStep} → completed`);
      }

      currentStep = nextStep;
    }

    if (state.status === "running") {
      state.status = "completed";
    }
  } catch (err) {
    state.status = "failed";
    const msg = err instanceof Error ? err.message : String(err);
    state.history.push({
      step: state.currentStep,
      input: null,
      output: null,
      status: "fail",
      error: msg,
      timestamp: Date.now(),
    });
    emit("error", { step: state.currentStep, reason: msg, runId: state.runId });
  }

  state.currentStep = null;

  const finalResult = {
    runId: state.runId,
    status: state.status,
    finalOutput: state.context.artifacts["reviewer"] ?? null,
    history: state.history,
  };

  emit("done", finalResult);
  return finalResult;
}

export { runPipeline, getNextStep };
