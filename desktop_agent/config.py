"""
desktop_agent/config.py

Central configuration for the desktop agent.

All tuneable parameters live here so they can be changed in one place
without hunting through individual modules.

Environment variable overrides are supported for every setting — useful
for CI, scripts, or running in VS Code's launch.json.

Usage:
    from desktop_agent.config import cfg

    # Read a value
    print(cfg.safe_mode)

    # Override at runtime (before anything else imports config)
    import os
    os.environ["DA_SAFE_MODE"] = "false"
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _bool(env_key: str, default: bool) -> bool:
    """Read a boolean from an environment variable."""
    val = os.environ.get(env_key)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _float(env_key: str, default: float) -> float:
    """Read a float from an environment variable."""
    val = os.environ.get(env_key)
    if val is None:
        return default
    try:
        return float(val)
    except ValueError:
        return default


def _int(env_key: str, default: int) -> int:
    """Read an int from an environment variable."""
    val = os.environ.get(env_key)
    if val is None:
        return default
    try:
        return int(val)
    except ValueError:
        return default


def _str(env_key: str, default: str) -> str:
    """Read a string from an environment variable."""
    return os.environ.get(env_key, default)


@dataclass(frozen=True)
class AgentConfig:
    """
    Immutable configuration object.

    All fields have sensible production-safe defaults.
    Override via environment variables (see each field's env key).
    """

    # ── Safety ──────────────────────────────────────────────────────────
    safe_mode: bool = field(
        default_factory=lambda: _bool("DA_SAFE_MODE", True)
    )
    """
    When True, only actions on the allowlist in safety.py are permitted.
    Default: True. Set DA_SAFE_MODE=false to disable (not recommended).
    """

    allow_dangerous_keys: bool = field(
        default_factory=lambda: _bool("DA_ALLOW_DANGEROUS_KEYS", False)
    )
    """
    When False (default), key combinations that can delete or alter the
    system (e.g. Alt+F4, Win+D, Ctrl+Alt+Del) are blocked.
    """

    allow_file_deletion: bool = field(
        default_factory=lambda: _bool("DA_ALLOW_FILE_DELETION", False)
    )
    """Whether the agent may run commands that delete files (rm, del, etc.)."""

    # ── Rate limiting ────────────────────────────────────────────────────
    action_delay_s: float = field(
        default_factory=lambda: _float("DA_ACTION_DELAY_S", 0.35)
    )
    """
    Minimum seconds between consecutive automation actions.
    Increase this if the agent is acting faster than the UI can respond.
    """

    max_actions_per_minute: int = field(
        default_factory=lambda: _int("DA_MAX_ACTIONS_PER_MINUTE", 30)
    )
    """Hard ceiling on how many actions the agent can take per minute."""

    # ── Loop control ─────────────────────────────────────────────────────
    max_cycles: int = field(
        default_factory=lambda: _int("DA_MAX_CYCLES", 100)
    )
    """Maximum loop iterations before the controller stops automatically."""

    fps: float = field(
        default_factory=lambda: _float("DA_FPS", 0.5)
    )
    """Screen captures per second (0.5 = one capture every 2 seconds)."""

    # ── LLM ─────────────────────────────────────────────────────────────
    llm_model: str = field(
        default_factory=lambda: _str("LLM_MODEL", "gpt-4o-mini")
    )
    llm_base_url: str | None = field(
        default_factory=lambda: _str("LLM_BASE_URL", "") or None  # type: ignore[return-value]
    )
    llm_temperature: float = field(
        default_factory=lambda: _float("DA_LLM_TEMPERATURE", 0.1)
    )

    # ── OCR ─────────────────────────────────────────────────────────────
    tesseract_cmd: str | None = field(
        default_factory=lambda: _str("DA_TESSERACT_CMD", "") or None  # type: ignore[return-value]
    )
    """
    Absolute path to the Tesseract binary if it is not on PATH.
    Example (Windows): C:\\Program Files\\Tesseract-OCR\\tesseract.exe
    """
    ocr_language: str = field(
        default_factory=lambda: _str("DA_OCR_LANG", "eng")
    )

    # ── Storage ──────────────────────────────────────────────────────────
    screenshot_dir: str = field(
        default_factory=lambda: _str("DA_SCREENSHOT_DIR", "desktop_agent_frames")
    )
    """Directory where debug screenshots are saved."""

    log_file: str | None = field(
        default_factory=lambda: _str("DA_LOG_FILE", "") or None  # type: ignore[return-value]
    )
    """
    If set, structured logs are also written to this file in addition to
    the terminal. Useful for post-run auditing.
    """

    # ── TaskFlow integration ─────────────────────────────────────────────
    taskflow_root: str = field(
        default_factory=lambda: _str("DA_TASKFLOW_ROOT", ".")
    )
    """Absolute or relative path to the TaskFlow project root."""

    taskflow_api_start_cmd: str = field(
        default_factory=lambda: _str("DA_API_CMD", "pnpm --filter @workspace/api-server dev")
    )
    taskflow_web_start_cmd: str = field(
        default_factory=lambda: _str("DA_WEB_CMD", "pnpm --filter @workspace/taskflow dev")
    )


# Module-level singleton — import this everywhere
cfg = AgentConfig()
