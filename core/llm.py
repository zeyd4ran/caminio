"""
core/llm.py

Central LLM interface shared by all agents.
Supports OpenAI-compatible APIs (OpenAI, Ollama, etc.).

Configure via environment variables:
  LLM_BASE_URL  - base URL (default: OpenAI)
  LLM_API_KEY   - API key (default: env OPENAI_API_KEY)
  LLM_MODEL     - model name (default: gpt-4o-mini)

Public API
----------
call_llm(system, user)          → str       (plain text response)
call_llm_json(system, user)     → dict      (structured JSON response)
AgentLLM(role, system_prompt)   → stateful per-agent interface
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from openai import OpenAI

logger = logging.getLogger(__name__)


# ── Connection helpers ──────────────────────────────────────────────────────

def get_client() -> OpenAI:
    """Return a configured OpenAI-compatible client."""
    base_url = os.environ.get("LLM_BASE_URL") or None
    api_key  = (
        os.environ.get("LLM_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or "no-key"
    )
    return OpenAI(api_key=api_key, base_url=base_url)


def get_model() -> str:
    """Return the model name from environment (default: gpt-4o-mini)."""
    return os.environ.get("LLM_MODEL", "gpt-4o-mini")


# ── Plain text call (backward-compatible) ───────────────────────────────────

def call_llm(
    system_prompt: str,
    user_prompt:   str,
    temperature:   float = 0.2,
) -> str:
    """
    Send a prompt to the LLM and return the text response.

    Args:
        system_prompt: Role/instruction context for the model.
        user_prompt:   The actual task or question.
        temperature:   Sampling temperature (lower = more deterministic).

    Returns:
        The model's response as a plain string.

    Raises:
        RuntimeError: If the API call fails.
    """
    client = get_client()
    model  = get_model()

    try:
        response = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        raise RuntimeError(f"LLM call failed: {exc}") from exc


# ── Structured JSON call ────────────────────────────────────────────────────

def call_llm_json(
    system_prompt: str,
    user_prompt:   str,
    temperature:   float = 0.1,
) -> dict[str, Any]:
    """
    Call the LLM and parse its response as JSON.

    The system prompt MUST instruct the model to return valid JSON.
    Uses OpenAI's json_object response format when supported; falls back
    to manual JSON parsing for other providers.

    Args:
        system_prompt: Must include an instruction to respond with JSON.
        user_prompt:   The task or question.
        temperature:   Lower is better for structured output (default 0.1).

    Returns:
        Parsed dict from the model's JSON response.

    Raises:
        RuntimeError:  If the API call fails.
        ValueError:    If the response cannot be parsed as JSON.
    """
    client = get_client()
    model  = get_model()

    # Append a hard reminder to return JSON (helps with non-OpenAI providers)
    system_with_reminder = (
        system_prompt.rstrip()
        + "\n\nIMPORTANT: Your entire response must be valid JSON. No other text."
    )

    try:
        # Try JSON mode first (OpenAI native support)
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_with_reminder},
                    {"role": "user",   "content": user_prompt},
                ],
            )
        except Exception:
            # Provider may not support response_format — fall back to plain call
            response = client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_with_reminder},
                    {"role": "user",   "content": user_prompt},
                ],
            )

        raw = (response.choices[0].message.content or "").strip()

        # Strip markdown fences if provider added them
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
            )

        return json.loads(raw)

    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned invalid JSON: {exc}\nRaw response: {raw!r}") from exc
    except Exception as exc:
        raise RuntimeError(f"LLM JSON call failed: {exc}") from exc


# ── Per-agent stateful interface ────────────────────────────────────────────

class AgentLLM:
    """
    Stateful LLM interface for a named agent.

    Maintains a short conversation history so the agent has context
    across multiple calls within a single controller cycle.

    Usage
    -----
        llm = AgentLLM(
            role="Architect",
            system_prompt="You are a software architect ...",
        )
        text   = llm.ask("Is this design scalable?")
        struct = llm.ask_json("Rate the code quality as JSON.")

    Parameters
    ----------
    role          : Human-readable agent name (used in logs).
    system_prompt : The agent's permanent instruction set.
    history_limit : Max messages to keep in memory (prevents prompt bloat).
    temperature   : Default sampling temperature.
    """

    def __init__(
        self,
        role:          str,
        system_prompt: str,
        history_limit: int   = 10,
        temperature:   float = 0.2,
    ) -> None:
        self.role          = role
        self._system       = system_prompt
        self._history:     list[dict[str, str]] = []
        self._history_limit = history_limit
        self._temperature  = temperature

    def ask(self, user_prompt: str, temperature: float | None = None) -> str:
        """
        Send a message and return the plain text response.
        The conversation history is maintained across calls.
        """
        temp = temperature if temperature is not None else self._temperature
        self._history.append({"role": "user", "content": user_prompt})

        client   = get_client()
        model    = get_model()
        messages = [{"role": "system", "content": self._system}] + self._history

        try:
            response = client.chat.completions.create(
                model=model,
                temperature=temp,
                messages=messages,
            )
            reply = response.choices[0].message.content or ""
        except Exception as exc:
            self._history.pop()   # roll back the failed message
            raise RuntimeError(f"[{self.role}] LLM call failed: {exc}") from exc

        self._history.append({"role": "assistant", "content": reply})
        self._trim_history()

        logger.debug("[%s] Response: %s", self.role, reply[:120])
        return reply

    def ask_json(
        self,
        user_prompt: str,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        """
        Send a message and return a parsed JSON dict.
        The model is instructed to respond with JSON only.
        """
        json_instruction = (
            "\n\nRespond with a single valid JSON object. No other text."
        )
        raw = self.ask(user_prompt + json_instruction, temperature=temperature or 0.1)

        # Strip fences
        text = raw.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(
                lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
            )

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"[{self.role}] Invalid JSON response: {exc}\nRaw: {raw!r}"
            ) from exc

    def reset_history(self) -> None:
        """Clear the conversation history."""
        self._history.clear()

    def _trim_history(self) -> None:
        """Keep history within the configured limit (pairs of user/assistant)."""
        max_msgs = self._history_limit * 2
        if len(self._history) > max_msgs:
            self._history = self._history[-max_msgs:]
