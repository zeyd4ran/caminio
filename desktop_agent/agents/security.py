"""
desktop_agent/agents/security.py

Security Agent.

Performs semantic security analysis on proposed actions — complementing the
rule-based safety.py guardrails with LLM reasoning about intent and impact.

safety.py   → fast, deterministic, pattern-based (runs first, always)
SecurityAgent → slower, semantic, reasoning-based (runs after planner,
                before execution, for medium/high-risk actions)

The Security Agent evaluates whether an action is safe given the current
goal and context, even when it doesn't match any known bad pattern.

Input  : proposed action + goal + context
Output : structured JSON assessment

    {
        "safe":        true | false,
        "risk_level":  "low" | "medium" | "high" | "critical",
        "concerns":    ["...", "..."],
        "verdict":     "Brief explanation."
    }
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from core.llm import AgentLLM

if TYPE_CHECKING:
    from desktop_agent.vision import ScreenContext


_SYSTEM_PROMPT = """You are the Security agent in a desktop AI automation system.

Your role is to assess whether a proposed action is safe to execute,
given the goal and current context.  You reason about intent and impact,
not just pattern matching.

You must respond with a JSON object:
{
    "safe":        true or false,
    "risk_level":  "low", "medium", "high", or "critical",
    "concerns":    ["concern 1", "concern 2"],
    "verdict":     "One-sentence summary of your decision."
}

Security principles:
- Flag anything that modifies system configuration as at least medium risk.
- Flag file deletion, mass overwrites, or process kills as high risk.
- Flag credential access, network configuration changes as critical.
- Terminal commands that run arbitrary code must be reviewed carefully.
- Actions that are reversible and scoped to the current project are low risk.
- When in doubt, flag as medium and list your concerns clearly.
- Never approve actions that could exfiltrate data or harm the OS.

Always consider the stated goal — an action that looks dangerous in isolation
may be clearly safe in context (e.g. deleting a temp file while cleaning up).
"""

# Risk levels that require Security Agent review (low is skipped for speed)
REVIEW_THRESHOLD = {"medium", "high", "critical"}


class SecurityAgent:
    """
    Semantic security analysis for proposed agent actions.

    Parameters
    ----------
    history_limit : int
        Message pairs to keep in conversation history.
    skip_low_risk : bool
        If True, skip LLM call for actions already assessed as low-risk
        by the caller (saves tokens for obvious safe actions).
    """

    def __init__(
        self,
        history_limit: int  = 6,
        skip_low_risk: bool = True,
    ) -> None:
        self._llm = AgentLLM(
            role="Security",
            system_prompt=_SYSTEM_PROMPT,
            history_limit=history_limit,
            temperature=0.05,   # very low temperature for consistent security decisions
        )
        self._skip_low_risk = skip_low_risk

    def assess(
        self,
        action:   str,
        goal:     str,
        context:  "ScreenContext | None" = None,
        pre_risk: str = "medium",
    ) -> dict[str, Any]:
        """
        Assess whether an action is safe to execute.

        Parameters
        ----------
        action   : The proposed action string (e.g. "RUN rm -rf /tmp/cache").
        goal     : The high-level goal the agent is pursuing.
        context  : Current screen state for additional context.
        pre_risk : Risk level estimated by a prior agent (e.g. Architect).
                   If "low" and skip_low_risk=True, skips the LLM call.

        Returns
        -------
        dict with keys: safe, risk_level, concerns, verdict
        """
        # Fast path for pre-assessed low-risk actions
        if self._skip_low_risk and pre_risk == "low":
            return _low_risk_pass(action)

        ctx_str = ""
        if context is not None:
            ctx_str = f"\n\nScreen context:\n{context.to_prompt_string()}"

        prompt = (
            f"Agent goal: {goal}\n"
            f"Proposed action: {action}"
            f"{ctx_str}"
            "\n\nAssess the security of this action and return your JSON verdict."
        )

        try:
            result = self._llm.ask_json(prompt)
            return _normalise_assessment(result)
        except Exception as exc:
            # Fail safe: if Security agent is down, flag as medium risk but allow
            return {
                "safe":       True,
                "risk_level": "medium",
                "concerns":   [f"Security agent unavailable: {exc}"],
                "verdict":    "Defaulting to allowed due to agent error.",
            }

    def reset(self) -> None:
        """Clear conversation history."""
        self._llm.reset_history()


def _normalise_assessment(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "safe":       bool(raw.get("safe", True)),
        "risk_level": str(raw.get("risk_level", "medium")).lower(),
        "concerns":   list(raw.get("concerns", [])),
        "verdict":    str(raw.get("verdict", "")),
    }


def _low_risk_pass(action: str) -> dict[str, Any]:
    return {
        "safe":       True,
        "risk_level": "low",
        "concerns":   [],
        "verdict":    f"Pre-assessed as low risk — skipped detailed review: {action[:60]}",
    }
