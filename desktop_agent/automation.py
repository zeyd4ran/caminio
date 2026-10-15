"""
desktop_agent/automation.py

Automation module — keyboard and mouse control.

Wraps pyautogui to provide safe, rate-limited automation actions that the
controller loop can execute in response to planner decisions.

SAFETY RULES (enforced automatically):
  - Every action has a minimum delay between calls (SAFETY_DELAY_S).
  - pyautogui's FAILSAFE is always enabled: move the mouse to the
    top-left corner of the screen to abort the agent immediately.
  - Destructive action helpers (type_text, press_key, click) all log
    what they are about to do before acting.

REQUIRES a physical display and pyautogui to be installed.
Will raise ImportError or pyautogui.FailSafeException in headless environments.

Dependencies:
  pip install pyautogui
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from desktop_agent.safety import SafetyGuard

from desktop_agent.config import cfg

logger = logging.getLogger(__name__)

try:
    import pyautogui

    # Always keep the failsafe active:
    # moving the cursor to (0, 0) raises pyautogui.FailSafeException.
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE    = cfg.action_delay_s   # driven by central config
    _PYAUTOGUI_AVAILABLE = True
except ImportError:
    _PYAUTOGUI_AVAILABLE = False


class Automation:
    """
    High-level automation interface for keyboard and mouse actions.

    Every public method:
      1. Calls safety_guard.check(action_token) — raises SafetyError if blocked.
      2. Logs the intended action.
      3. Executes it (unless dry_run=True).
      4. Calls safety_guard.record_action() for rate-limit accounting.

    Parameters
    ----------
    safety_guard : SafetyGuard | None
        The shared SafetyGuard instance.  If None, a default guard is created
        using the module-level cfg.  Pass an explicit guard so the controller
        and automation layer share the same rate-limit counter.
    dry_run : bool
        If True, actions are logged but NOT executed.
        Use this for testing the decision loop without touching the OS.
    """

    def __init__(
        self,
        safety_guard: "SafetyGuard | None" = None,
        dry_run: bool = False,
    ) -> None:
        from desktop_agent.safety import SafetyGuard as _Guard
        self._guard   = safety_guard if safety_guard is not None else _Guard(cfg)
        self._dry_run = dry_run
        if dry_run:
            logger.info("[Automation] DRY RUN mode — no actions will be executed.")

    # ------------------------------------------------------------------
    # Internal safety helpers
    # ------------------------------------------------------------------

    def _safe(self, action_token: str) -> None:
        """
        Route an action through the safety guard before execution.

        Raises SafetyError (from safety.py) if the action is blocked.
        Records the action with the guard for rate-limit accounting on success.
        """
        self._guard.check(action_token)
        # record_action is called after execution in each method below
        # so the timestamp reflects when the action actually ran.

    def _record(self) -> None:
        """Tell the safety guard an action was executed right now."""
        self._guard.record_action()

    # ------------------------------------------------------------------
    # Mouse actions
    # ------------------------------------------------------------------

    def move_to(self, x: int, y: int, duration: float = 0.25) -> None:
        """
        Move the mouse cursor to absolute screen coordinates (x, y).

        Parameters
        ----------
        x, y     : target pixel coordinates
        duration : seconds to animate the movement (0 = instant)
        """
        self._safe(f"MOVE {x} {y}")
        logger.info("[Automation] move_to(%d, %d)", x, y)
        if not self._dry_run:
            self._require()
            pyautogui.moveTo(x, y, duration=duration)
        self._record()

    def click(self, x: int, y: int, button: str = "left") -> None:
        """
        Click the mouse at screen coordinates (x, y).

        Parameters
        ----------
        x, y   : target pixel coordinates
        button : "left" | "right" | "middle"
        """
        self._safe(f"CLICK {x} {y}")
        logger.info("[Automation] click(%d, %d, button=%s)", x, y, button)
        if not self._dry_run:
            self._require()
            pyautogui.click(x, y, button=button)
        self._record()

    def double_click(self, x: int, y: int) -> None:
        """Double-click at screen coordinates (x, y)."""
        self._safe(f"DOUBLE_CLICK {x} {y}")
        logger.info("[Automation] double_click(%d, %d)", x, y)
        if not self._dry_run:
            self._require()
            pyautogui.doubleClick(x, y)
        self._record()

    def right_click(self, x: int, y: int) -> None:
        """Right-click at screen coordinates (x, y)."""
        self._safe(f"RIGHT_CLICK {x} {y}")
        logger.info("[Automation] right_click(%d, %d)", x, y)
        if not self._dry_run:
            self._require()
            pyautogui.rightClick(x, y)
        self._record()

    def scroll(self, clicks: int, x: int | None = None, y: int | None = None) -> None:
        """
        Scroll the mouse wheel at an optional position.

        Parameters
        ----------
        clicks : positive = scroll up, negative = scroll down
        x, y   : scroll at these coordinates (default: current cursor position)
        """
        self._safe(f"SCROLL {clicks}")
        logger.info("[Automation] scroll(clicks=%d, x=%s, y=%s)", clicks, x, y)
        if not self._dry_run:
            self._require()
            pyautogui.scroll(clicks, x=x, y=y)
        self._record()

    # ------------------------------------------------------------------
    # Keyboard actions
    # ------------------------------------------------------------------

    def type_text(self, text: str, interval: float = 0.02) -> None:
        """
        Type a string character by character.

        Parameters
        ----------
        text     : the text to type
        interval : seconds between each keystroke
        """
        self._safe(f"TYPE {text[:80]}")
        preview = text[:60] + ("..." if len(text) > 60 else "")
        logger.info("[Automation] type_text(%r)", preview)
        if not self._dry_run:
            self._require()
            pyautogui.typewrite(text, interval=interval)
        self._record()

    def press_key(self, *keys: str) -> None:
        """
        Press one or more keys simultaneously (hotkey).

        Examples
        --------
            auto.press_key("ctrl", "c")   # Copy
            auto.press_key("alt", "F4")   # Close window (Windows) — blocked by default
            auto.press_key("enter")       # Press Enter
            auto.press_key("ctrl", "z")   # Undo

        Valid key names: https://pyautogui.readthedocs.io/en/latest/keyboard.html
        """
        self._safe(f"PRESS {' '.join(keys)}")
        logger.info("[Automation] press_key(%s)", " + ".join(keys))
        if not self._dry_run:
            self._require()
            if len(keys) == 1:
                pyautogui.press(keys[0])
            else:
                pyautogui.hotkey(*keys)
        self._record()

    def write_line(self, text: str) -> None:
        """Type text followed by Enter — useful for terminal commands."""
        self.type_text(text)
        self.press_key("enter")

    # ------------------------------------------------------------------
    # Clipboard actions
    # ------------------------------------------------------------------

    def copy(self) -> None:
        """Trigger Ctrl+C (or Cmd+C on macOS)."""
        import platform
        mod = "command" if platform.system() == "Darwin" else "ctrl"
        self.press_key(mod, "c")

    def paste(self) -> None:
        """Trigger Ctrl+V (or Cmd+V on macOS)."""
        import platform
        mod = "command" if platform.system() == "Darwin" else "ctrl"
        self.press_key(mod, "v")

    # ------------------------------------------------------------------
    # Composite helpers
    # ------------------------------------------------------------------

    def open_terminal(self) -> None:
        """
        Open a terminal window using OS-specific shortcuts.
        Falls back to a log warning if the OS is unrecognised.
        """
        import platform
        os_name = platform.system()
        logger.info("[Automation] open_terminal() on %s", os_name)
        if os_name == "Windows":
            self.press_key("win", "r")
            time.sleep(0.5)
            self.type_text("cmd")
            self.press_key("enter")
        elif os_name == "Darwin":
            self.press_key("command", "space")
            time.sleep(0.3)
            self.type_text("Terminal")
            self.press_key("enter")
        elif os_name == "Linux":
            # Common shortcut on many desktop environments
            self.press_key("ctrl", "alt", "t")
        else:
            logger.warning("[Automation] Unknown OS: %s — cannot open terminal.", os_name)

    def run_command(self, command: str) -> None:
        """
        Type and execute a shell command in a focused terminal window.

        The caller is responsible for ensuring a terminal is already
        in focus before calling this method.
        """
        logger.info("[Automation] run_command(%r)", command)
        self.write_line(command)

    # ------------------------------------------------------------------
    # Screen info (no GUI required)
    # ------------------------------------------------------------------

    @staticmethod
    def screen_size() -> tuple[int, int]:
        """Return (width, height) of the primary monitor in pixels."""
        if not _PYAUTOGUI_AVAILABLE:
            raise ImportError("pyautogui is not installed. Run: pip install pyautogui")
        return pyautogui.size()

    # ------------------------------------------------------------------
    # Safety
    # ------------------------------------------------------------------

    @staticmethod
    def emergency_stop() -> None:
        """
        Move the cursor to (0, 0) immediately.
        This triggers pyautogui's built-in FailSafe and aborts the agent.
        """
        if _PYAUTOGUI_AVAILABLE:
            pyautogui.moveTo(0, 0, duration=0)

    @staticmethod
    def _require() -> None:
        if not _PYAUTOGUI_AVAILABLE:
            raise ImportError(
                "pyautogui is not installed. Run: pip install pyautogui\n"
                "Note: pyautogui requires a physical display and will not work "
                "in headless cloud environments."
            )
