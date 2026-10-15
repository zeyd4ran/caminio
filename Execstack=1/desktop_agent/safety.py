"""
desktop_agent/safety.py

Safety and guardrails layer.

Every action the agent wants to take MUST pass through SafetyGuard.check()
before it reaches the OS. This module is the last line of defence against
runaway, destructive, or unintended automation.

Protections implemented
-----------------------
1. SAFE_MODE gate        — only allowlisted action tokens are permitted.
2. Dangerous key block   — hotkeys that can destroy windows / OS state.
3. Command blocklist     — shell commands containing destructive patterns.
4. Rate limiter          — hard ceiling on actions per minute.
5. Emergency stop flag   — call SafetyGuard.emergency_stop() from any thread.
6. Audit log             — every decision (allow / deny) is written to the logger.

Usage
-----
    from desktop_agent.safety import SafetyGuard, SafetyError
    from desktop_agent.config import cfg

    guard = SafetyGuard(cfg)

    try:
        guard.check("CLICK 100 200")   # OK
        guard.check("RUN rm -rf /")    # raises SafetyError
    except SafetyError as e:
        print(f"Blocked: {e}")

    # Abort from another thread / signal handler:
    guard.emergency_stop()
"""

from __future__ import annotations

import logging
import re
import threading
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from desktop_agent.config import AgentConfig

logger = logging.getLogger(__name__)


# ── Exceptions ────────────────────────────────────────────────────────────────

class SafetyError(RuntimeError):
    """Raised when an action is blocked by the safety layer."""


class EmergencyStopError(SafetyError):
    """Raised when the emergency stop flag has been set."""


# ── Constants ─────────────────────────────────────────────────────────────────

# The complete set of action tokens the agent is permitted to issue.
# Any token not in this set is rejected in safe_mode.
ALLOWED_ACTION_TOKENS: frozenset[str] = frozenset({
    "CLICK",
    "RIGHT_CLICK",
    "DOUBLE_CLICK",
    "MOVE",
    "SCROLL",
    "TYPE",
    "PRESS",
    "RUN",
    "OPEN_TERMINAL",
    "WAIT",
    "SCREENSHOT",
    "DONE",
})

# Hotkey combinations that can cause irreversible OS-level actions.
# Each entry is a frozenset of key names (lowercase).
DANGEROUS_HOTKEYS: list[frozenset[str]] = [
    frozenset({"alt",  "f4"}),            # Close application (Windows)
    frozenset({"ctrl", "alt", "delete"}), # Task manager / lock screen
    frozenset({"ctrl", "alt", "del"}),    # Same, alternative spelling
    frozenset({"win",  "d"}),             # Show desktop (Windows)
    frozenset({"win",  "l"}),             # Lock screen (Windows)
    frozenset({"cmd",  "q"}),             # Quit application (macOS)
    frozenset({"ctrl", "shift", "q"}),    # Log out (Linux/Chrome OS)
    frozenset({"super", "l"}),            # Lock screen (Linux)
]

# Shell / terminal command patterns that are always blocked.
# Matched case-insensitively against the full command string.
DANGEROUS_COMMAND_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\brm\s+-[a-z]*r[a-z]*f[a-z]*\b"),   # rm -rf
    re.compile(r"\brm\s+-[a-z]*f[a-z]*r[a-z]*\b"),   # rm -fr
    re.compile(r"\bdel\s+/[sqf]"),                     # del /s /q /f
    re.compile(r"\bformat\s+[a-z]:"),                  # format C:
    re.compile(r"\bmkfs\b"),                           # mkfs (reformat)
    re.compile(r"\bdd\s+if="),                         # dd if=... (disk write)
    re.compile(r"\bsudo\s+rm\b"),                      # sudo rm
    re.compile(r">\s*/dev/sd[a-z]"),                   # write to raw device
    re.compile(r"\bshutdown\b"),                       # shutdown
    re.compile(r"\breboot\b"),                         # reboot
    re.compile(r"\bpoweroff\b"),                       # poweroff
    re.compile(r"\bkill\s+-9\s+1\b"),                  # kill init (Linux)
]


# ── Safety guard ──────────────────────────────────────────────────────────────

class SafetyGuard:
    """
    Validates every proposed action before it reaches the OS.

    Parameters
    ----------
    config : AgentConfig
        The central configuration object (from config.py).
    """

    def __init__(self, config: "AgentConfig") -> None:
        self._cfg = config
        self._stop_event = threading.Event()
        self._action_timestamps: list[float] = []
        self._lock = threading.Lock()

    # ── Public API ────────────────────────────────────────────────────────

    def check(self, action: str) -> None:
        """
        Validate an action string.

        Raises SafetyError (or a subclass) if the action is not permitted.
        Returns normally if the action is safe to execute.

        Parameters
        ----------
        action : str
            The full action string, e.g. "CLICK 100 200" or "RUN ls -la".
        """
        # 1. Emergency stop takes priority over everything
        if self._stop_event.is_set():
            raise EmergencyStopError("Emergency stop is active. No actions permitted.")

        token, _, args = action.strip().partition(" ")
        token = token.upper()

        # 2. Allowlist gate (only in safe_mode)
        if self._cfg.safe_mode:
            self._check_allowlist(token)

        # 3. Token-specific checks
        if token == "PRESS":
            self._check_hotkey(args)

        if token == "RUN":
            self._check_command(args)

        # 4. Rate limiter
        self._check_rate()

        # Passed all checks
        logger.info("[Safety] ALLOWED: %s", action[:120])

    def emergency_stop(self) -> None:
        """
        Set the emergency stop flag immediately.

        All subsequent calls to check() will raise EmergencyStopError.
        Safe to call from any thread (e.g. a signal handler).
        """
        self._stop_event.set()
        logger.critical("[Safety] EMERGENCY STOP activated. Agent is halted.")

    def reset_emergency_stop(self) -> None:
        """
        Clear the emergency stop flag.

        Should only be called by a human operator after reviewing the
        situation — not by the agent itself.
        """
        self._stop_event.clear()
        logger.warning("[Safety] Emergency stop cleared by operator.")

    @property
    def is_stopped(self) -> bool:
        """True if the emergency stop flag is set."""
        return self._stop_event.is_set()

    def record_action(self) -> None:
        """
        Record that an action was executed right now.
        Called by the automation layer after each successful execution.
        """
        with self._lock:
            now = time.monotonic()
            self._action_timestamps.append(now)
            # Prune timestamps older than 60 seconds
            cutoff = now - 60.0
            self._action_timestamps = [t for t in self._action_timestamps if t >= cutoff]

    # ── Private validators ────────────────────────────────────────────────

    def _check_allowlist(self, token: str) -> None:
        if token not in ALLOWED_ACTION_TOKENS:
            msg = (
                f"Action token {token!r} is not on the allowlist. "
                "Disable safe_mode or add it to ALLOWED_ACTION_TOKENS."
            )
            logger.warning("[Safety] BLOCKED (not allowlisted): %s", token)
            raise SafetyError(msg)

    def _check_hotkey(self, keys_str: str) -> None:
        if self._cfg.allow_dangerous_keys:
            return  # user explicitly unlocked dangerous keys

        keys = frozenset(k.strip().lower() for k in keys_str.split())

        for dangerous in DANGEROUS_HOTKEYS:
            if dangerous.issubset(keys):
                msg = (
                    f"Hotkey {keys_str!r} matches a blocked combination: "
                    f"{' + '.join(sorted(dangerous))}. "
                    "Set DA_ALLOW_DANGEROUS_KEYS=true to permit this."
                )
                logger.warning("[Safety] BLOCKED (dangerous hotkey): %s", keys_str)
                raise SafetyError(msg)

    def _check_command(self, command: str) -> None:
        if self._cfg.allow_file_deletion:
            return  # user explicitly unlocked file deletion

        cmd_lower = command.strip().lower()

        for pattern in DANGEROUS_COMMAND_PATTERNS:
            if pattern.search(cmd_lower):
                msg = (
                    f"Command {command!r} matches a blocked pattern: "
                    f"{pattern.pattern!r}. "
                    "Set DA_ALLOW_FILE_DELETION=true to permit destructive commands."
                )
                logger.warning("[Safety] BLOCKED (dangerous command): %s", command[:120])
                raise SafetyError(msg)

    def _check_rate(self) -> None:
        with self._lock:
            now = time.monotonic()
            cutoff = now - 60.0
            recent = [t for t in self._action_timestamps if t >= cutoff]

            if len(recent) >= self._cfg.max_actions_per_minute:
                msg = (
                    f"Rate limit reached: {len(recent)} actions in the last 60 s "
                    f"(max: {self._cfg.max_actions_per_minute}). "
                    "Increase DA_MAX_ACTIONS_PER_MINUTE or slow down the loop."
                )
                logger.warning("[Safety] BLOCKED (rate limit): %d/%d actions/min",
                               len(recent), self._cfg.max_actions_per_minute)
                raise SafetyError(msg)
