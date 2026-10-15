"""
desktop_agent/agents/architect.py

Architect Agent.

Validates that a proposed task or action follows good system design before
the Coder or Automation layer executes it.  Acts as a gate-keeper for
architectural integrity — catches bad patterns, scope creep, and approaches
that would create technical debt.

Input  : proposed task description + current screen context
Output : structured JSON verdict

    {
        "approved":    true | false,
        "reason":      "...",
        "alternative": "..." | null,   # suggested better approach if rejected
        "risk_level":  "low" | "medium" | "high"
    }
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from core.llm import AgentLLM

if TYPE_CHECKING:
    from desktop_agent.vision import ScreenContext


_SYSTEM_PROMPT = """You are the Architect agent in a desktop AI automation system.

Your role is to review a proposed task BEFORE it is executed and decide whether
the approach is sound, safe, and aligned with good software engineering practice.

You must respond with a JSON object containing:
{
    "approved":    true or false,
    "reason":      "Brief explanation of your decision.",
    "alternative": "A better approach if you rejected the task, or null.",
    "risk_level":  "low", "medium", or "high"
}

Guidelines:
- Approve simple, incremental, reversible actions.
- Reject actions that are overly broad, destructive, or skip important steps.
- Reject actions that would modify unrelated parts of the system.
- Suggest smaller, safer alternatives when rejecting.
- Approve terminal/file operations over GUI clicks when both would work.
- Flag anything that touches system files, credentials, or network config as high risk.
"""


class ArchitectAgent:
    """
    Reviews proposed tasks for architectural soundness before execution.

    Parameters
    ----------
    history_limit : int
        How many message pairs to retain in conversation history.
    """

    def __init__(self, history_limit: int = 6) -> None:
        self._llm = AgentLLM(
            role="Architect",
            system_prompt=_SYSTEM_PROMPT,
            history_limit=history_limit,
            temperature=0.1,
        )

    def validate(
        self,
        proposed_task: str,
        context: "ScreenContext | None" = None,
    ) -> dict[str, Any]:
        """
        Evaluate a proposed task and return a structured verdict.

        Parameters
        ----------
        proposed_task : str
            The action or task the Planner wants to execute next.
        context : ScreenContext | None
            Current screen state for additional context.

        Returns
        -------
        dict with keys: approved, reason, alternative, risk_level
        """
        ctx_str = ""
        if context is not None:
            ctx_str = f"\n\nCurrent screen context:\n{context.to_prompt_string()}"

        prompt = (
            f"Proposed task:\n{proposed_task}"
            f"{ctx_str}"
            "\n\nEvaluate this task and return your JSON verdict."
        )

        try:
            result = self._llm.ask_json(prompt)
            return _normalise_verdict(result)
        except Exception as exc:
            # Fail open with a cautious default — do not block the loop on LLM errors
            return {
                "approved":    True,
                "reason":      f"Architect unavailable ({exc}); defaulting to approved.",
                "alternative": None,
                "risk_level":  "medium",
            }

    def reset(self) -> None:
        """Clear conversation history between controller cycles."""
        self._llm.reset_history()


def _normalise_verdict(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure all expected keys are present with sensible defaults."""
    return {
        "approved":    bool(raw.get("approved", True)),
        "reason":      str(raw.get("reason", "")),
        "alternative": raw.get("alternative"),
        "risk_level":  str(raw.get("risk_level", "medium")).lower(),
    }
