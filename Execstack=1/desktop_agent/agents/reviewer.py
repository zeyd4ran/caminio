"""
desktop_agent/agents/reviewer.py

Reviewer Agent.

Runs after each executed action to assess what happened, identify problems,
and suggest concrete improvements for the next cycle.  Drives the
self-improvement loop described in the system spec.

Input  : completed action + outcome (stdout/stderr if any) + screen context
Output : structured JSON review

    {
        "outcome":      "success" | "partial" | "failure",
        "observations": ["...", "..."],
        "improvements": ["...", "..."],
        "next_hint":    "Suggested focus for the next cycle."
    }
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from core.llm import AgentLLM

if TYPE_CHECKING:
    from desktop_agent.vision import ScreenContext


_SYSTEM_PROMPT = """You are the Reviewer agent in a desktop AI automation system.

After each action is executed, you review what happened and identify how to do
better in the next cycle.  Your feedback feeds directly into the Planner and
creates a continuous improvement loop.

You must respond with a JSON object:
{
    "outcome":      "success", "partial", or "failure",
    "observations": ["observation 1", "observation 2"],
    "improvements": ["improvement suggestion 1", "improvement suggestion 2"],
    "next_hint":    "One concrete suggestion for the next action to take."
}

Guidelines:
- Be specific and actionable — vague feedback is useless.
- If the action succeeded cleanly, say so and suggest the next logical step.
- If errors occurred, identify the root cause.
- If the approach is inefficient, suggest a better one.
- Keep observations and improvements lists to 3 items maximum.
"""


class ReviewerAgent:
    """
    Reviews completed actions and generates improvement suggestions.

    Parameters
    ----------
    history_limit : int
        How many message pairs to retain across calls.
    """

    def __init__(self, history_limit: int = 8) -> None:
        self._llm = AgentLLM(
            role="Reviewer",
            system_prompt=_SYSTEM_PROMPT,
            history_limit=history_limit,
            temperature=0.3,
        )

    def review(
        self,
        action_taken:   str,
        outcome_text:   str = "",
        context:        "ScreenContext | None" = None,
    ) -> dict[str, Any]:
        """
        Review a completed action and return improvement suggestions.

        Parameters
        ----------
        action_taken  : The action string that was executed.
        outcome_text  : stdout / stderr captured from the action, if any.
        context       : Screen state observed after the action.

        Returns
        -------
        dict with keys: outcome, observations, improvements, next_hint
        """
        parts = [f"Action executed:\n{action_taken}"]

        if outcome_text:
            parts.append(f"Outcome / output:\n{outcome_text[:800]}")

        if context is not None:
            parts.append(f"Screen context after action:\n{context.to_prompt_string()}")

        prompt = "\n\n".join(parts) + "\n\nReview this and return your JSON assessment."

        try:
            result = self._llm.ask_json(prompt)
            return _normalise_review(result)
        except Exception as exc:
            return {
                "outcome":      "unknown",
                "observations": [f"Reviewer unavailable: {exc}"],
                "improvements": [],
                "next_hint":    "",
            }

    def reset(self) -> None:
        """Clear conversation history between sessions."""
        self._llm.reset_history()


def _normalise_review(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure all expected keys are present with sensible defaults."""
    return {
        "outcome":      str(raw.get("outcome", "unknown")),
        "observations": list(raw.get("observations", [])),
        "improvements": list(raw.get("improvements", [])),
        "next_hint":    str(raw.get("next_hint", "")),
    }
