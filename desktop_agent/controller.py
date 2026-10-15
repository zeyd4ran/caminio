"""
desktop_agent/controller.py

Main controller loop — the brain of the desktop agent.

Architecture
------------
Each cycle follows the OODA loop:

  Observe  → grab a screenshot (screen.py)
  Orient   → extract text and context (vision.py)
  Decide   → ask the Planner agent what to do next (agents/planner.py)
  Act      → execute the chosen action (automation.py)

The Planner receives:
  - the high-level goal
  - the current screen context (as text)
  - a history of recent actions

The Planner returns one of a fixed set of action tokens that the controller
maps to an actual automation call. This keeps the LLM output deterministic
and prevents free-form hallucinated actions from reaching the OS.

Supported action tokens (returned by Planner)
---------------------------------------------
  DONE                          — goal complete, stop the loop
  CLICK <x> <y>                 — left-click at pixel (x, y)
  RIGHT_CLICK <x> <y>           — right-click at pixel (x, y)
  TYPE <text>                   — type a string (surround with quotes if spaces)
  RUN <command>                 — type a command + Enter in a terminal
  PRESS <key1> [key2 ...]       — press a hotkey combination
  SCROLL <clicks> [<x> <y>]    — scroll the wheel
  OPEN_TERMINAL                 — open a new terminal window
  WAIT <seconds>                — pause before next action
  SCREENSHOT                    — capture and save current screen (for debugging)

Usage
-----
    from desktop_agent.controller import DesktopController

    agent = DesktopController(
        goal="Open VS Code and create a file called hello.py",
        dry_run=True,           # True = log actions but don't execute them
        max_cycles=50,
        fps=0.5,
    )
    agent.run()

Running from the terminal:
    python -m desktop_agent.controller --goal "Open VS Code" --dry-run
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

# Modules in this package
from desktop_agent.config          import cfg
from desktop_agent.safety          import SafetyGuard, SafetyError, EmergencyStopError
from desktop_agent.screen          import Capture
from desktop_agent.vision          import Vision, ScreenContext
from desktop_agent.automation      import Automation
from desktop_agent.agents.architect import ArchitectAgent
from desktop_agent.agents.reviewer  import ReviewerAgent
from desktop_agent.agents.security  import SecurityAgent

# Multi-agent core (lives alongside desktop_agent/ in the project root)
try:
    from core.llm    import AgentLLM
    from core.memory import load as mem_load, save as mem_save, record_error as mem_error
    _LLM_AVAILABLE = True
except ImportError:
    _LLM_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

SEPARATOR = "=" * 60


# ------------------------------------------------------------------
# Planner agent system prompt
# ------------------------------------------------------------------

_PLANNER_SYSTEM = """You are the Planner agent in a desktop AI automation system.

You receive:
  1. A high-level goal
  2. A structured description of the current screen
  3. A history of recent actions (including any that were blocked or failed)

Your job: return EXACTLY ONE action token from the list below. Nothing else.

Allowed actions:
  DONE
  CLICK <x> <y>
  RIGHT_CLICK <x> <y>
  TYPE <text>
  RUN <command>
  PRESS <key1> [key2 ...]
  SCROLL <clicks> [<x> <y>]
  OPEN_TERMINAL
  WAIT <seconds>
  SCREENSHOT

Rules:
  - Return only the action string. No explanation, no prefix, no markdown.
  - Use DONE only when the goal is fully and verifiably achieved.
  - Prefer RUN (terminal command) over GUI clicks when both would work.
  - If you see a BLOCKED entry in history, choose a different approach.
  - If you are unsure what is on screen, return SCREENSHOT.
"""


# ------------------------------------------------------------------
# Controller
# ------------------------------------------------------------------

class DesktopController:
    """
    Orchestrates the observe → orient → decide → act loop.

    Parameters
    ----------
    goal      : the high-level objective the agent should accomplish
    dry_run   : if True, actions are logged but not executed (safe for testing)
    max_cycles: safety limit — the loop stops after this many iterations
    fps       : desired captures per second (lower = more conservative)
    save_dir  : directory to save debug screenshots; None = don't save
    """

    def __init__(
        self,
        goal: str,
        dry_run: bool = False,
        max_cycles: int | None = None,
        fps: float | None = None,
        save_dir: str | None = None,
    ) -> None:
        self.goal       = goal
        self.dry_run    = dry_run
        self.max_cycles = max_cycles if max_cycles is not None else cfg.max_cycles
        self.fps        = fps        if fps        is not None else cfg.fps

        # Single shared SafetyGuard — automation and controller use the same
        # instance so rate-limit accounting is centralised.
        self._guard = SafetyGuard(cfg)

        self._capture    = Capture(save_dir=save_dir or cfg.screenshot_dir)
        self._vision     = Vision(
            tesseract_cmd=cfg.tesseract_cmd,
            lang=cfg.ocr_language,
        )
        self._automation = Automation(safety_guard=self._guard, dry_run=dry_run)

        # Multi-agent ensemble
        self._architect  = ArchitectAgent()
        self._reviewer   = ReviewerAgent()
        self._security   = SecurityAgent()
        if _LLM_AVAILABLE:
            self._planner = AgentLLM(
                role="Planner",
                system_prompt=_PLANNER_SYSTEM,
                history_limit=12,
                temperature=0.1,
            )
        else:
            self._planner = None  # type: ignore[assignment]

        self._action_history: list[str] = []

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Start the perception → decision → action loop."""
        logger.info(SEPARATOR)
        logger.info("Desktop Agent starting")
        logger.info("Goal: %s", self.goal)
        logger.info("Dry run: %s  |  Max cycles: %d  |  FPS: %.1f",
                    self.dry_run, self.max_cycles, self.fps)
        logger.info(SEPARATOR)

        interval = 1.0 / max(self.fps, 0.01)

        for cycle in range(1, self.max_cycles + 1):
            logger.info("── Cycle %d / %d ──", cycle, self.max_cycles)
            cycle_start = time.perf_counter()

            try:
                done = self._cycle()
            except EmergencyStopError:
                logger.critical("[Safety] Agent halted by emergency stop.")
                break
            except KeyboardInterrupt:
                logger.info("Interrupted by user — activating emergency stop.")
                self._guard.emergency_stop()
                break
            except Exception as exc:
                logger.error("Unhandled error in cycle %d: %s", cycle, exc, exc_info=True)
                done = False

            if done:
                logger.info(SEPARATOR)
                logger.info("Goal achieved. Agent stopping.")
                logger.info(SEPARATOR)
                break

            # Throttle to the requested FPS
            elapsed = time.perf_counter() - cycle_start
            sleep_for = interval - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)
        else:
            logger.warning("Max cycles (%d) reached without completing goal.", self.max_cycles)

    # ------------------------------------------------------------------
    # Single cycle
    # ------------------------------------------------------------------

    def _cycle(self) -> bool:
        """
        Execute one full multi-agent cycle:

            Observe → Orient → Plan → Architect → Security
                → Safety → Execute → Review

        Returns True when the goal is complete (agent should stop).
        Raises EmergencyStopError if the emergency stop flag is set.
        """
        # Emergency stop propagates immediately — do not catch it here.
        if self._guard.is_stopped:
            raise EmergencyStopError("Emergency stop is active.")

        # ── 1. OBSERVE ──────────────────────────────────────────────────
        logger.info("[Observe] Capturing screen...")
        img = self._capture.grab_primary()

        # ── 2. ORIENT ───────────────────────────────────────────────────
        logger.info("[Orient] Analysing screen content...")
        context = self._vision.analyze(img)
        logger.info("[Orient] %s", context.summary)
        if context.intent_hint:
            logger.info("[Orient] Intent hint: %s", context.intent_hint)

        # ── 3. PLAN ─────────────────────────────────────────────────────
        logger.info("[Planner] Deciding next action...")
        action = self._plan(context)
        logger.info("[Planner] Proposed: %s", action)

        if action.strip().upper() == "DONE":
            return True

        # ── 4. ARCHITECT REVIEW ─────────────────────────────────────────
        logger.info("[Architect] Reviewing proposed action...")
        arch_verdict = self._architect.validate(action, context)
        logger.info("[Architect] %s — %s", arch_verdict["risk_level"].upper(), arch_verdict["reason"])

        if not arch_verdict["approved"]:
            alt = arch_verdict.get("alternative") or "SCREENSHOT"
            logger.warning("[Architect] Action rejected. Using alternative: %s", alt)
            self._action_history.append(f"REJECTED by Architect: {action}")
            action = alt

        # ── 5. SECURITY CHECK ───────────────────────────────────────────
        logger.info("[Security] Assessing action safety...")
        sec_result = self._security.assess(
            action=action,
            goal=self.goal,
            context=context,
            pre_risk=arch_verdict["risk_level"],
        )
        logger.info("[Security] %s — %s", sec_result["risk_level"].upper(), sec_result["verdict"])

        if not sec_result["safe"]:
            for concern in sec_result["concerns"]:
                logger.warning("[Security] Concern: %s", concern)
            logger.error("[Security] Action blocked by security agent: %s", action)
            self._action_history.append(f"BLOCKED by Security: {action}")
            return False

        if sec_result["risk_level"] == "critical":
            logger.error("[Security] CRITICAL risk — refusing to execute: %s", action)
            self._action_history.append(f"BLOCKED (critical risk): {action}")
            return False

        # ── 6. SAFETY GUARD (rule-based) ─────────────────────────────────
        try:
            self._guard.check(action)
        except EmergencyStopError:
            raise  # propagate to main loop
        except SafetyError as exc:
            logger.warning("[Safety] Action blocked by safety guard: %s", exc)
            self._action_history.append(f"BLOCKED by Safety: {action}")
            return False

        # ── 7. EXECUTE ──────────────────────────────────────────────────
        outcome = self._execute(action, img)
        self._action_history.append(action)

        # ── 8. REVIEW ───────────────────────────────────────────────────
        logger.info("[Reviewer] Reviewing outcome...")
        review = self._reviewer.review(
            action_taken=action,
            outcome_text=outcome or "",
            context=context,
        )
        logger.info("[Reviewer] %s — %s", review["outcome"].upper(), review["next_hint"])
        for obs in review["observations"]:
            logger.info("[Reviewer] Observation: %s", obs)

        # Feed the reviewer's next_hint back into the planner as a hint
        if review["next_hint"] and self._planner is not None:
            self._planner.ask(
                f"[Reviewer feedback from last action]: {review['next_hint']}"
            )

        # ── 9. MEMORY UPDATE ────────────────────────────────────────────
        if _LLM_AVAILABLE:
            try:
                mem_state = mem_load()
                summary_line = f"{action} → {review['outcome']}"
                if summary_line not in mem_state["completed"]:
                    mem_state["completed"].append(summary_line)
                # Keep completed list from growing unbounded
                if len(mem_state["completed"]) > 50:
                    mem_state["completed"] = mem_state["completed"][-50:]
                mem_save(mem_state)
            except Exception:
                pass  # memory write errors must not break the loop

        # Keep action history bounded
        if len(self._action_history) > 20:
            self._action_history = self._action_history[-20:]

        return False

    # ------------------------------------------------------------------
    # Planning
    # ------------------------------------------------------------------

    def _plan(self, context: ScreenContext) -> str:
        """
        Build a prompt from the goal + context + history and send it to the
        stateful Planner AgentLLM.  Falls back to SCREENSHOT if unavailable.
        """
        if not _LLM_AVAILABLE or self._planner is None:
            logger.warning("[Planner] LLM not available — defaulting to SCREENSHOT.")
            return "SCREENSHOT"

        history_text = (
            "\n".join(f"  {i+1}. {a}" for i, a in enumerate(self._action_history[-10:]))
            or "  (none yet)"
        )

        user_prompt = (
            f"Goal: {self.goal}\n\n"
            f"Current screen:\n{context.to_prompt_string()}\n\n"
            f"Recent actions:\n{history_text}\n\n"
            "What is the single next action?"
        )

        try:
            return self._planner.ask(user_prompt).strip()
        except Exception as exc:
            logger.error("[Planner] LLM call failed: %s", exc)
            return "SCREENSHOT"

    # ------------------------------------------------------------------
    # Action dispatch
    # ------------------------------------------------------------------

    def _execute(self, action: str, img: "object | None" = None) -> str:
        """
        Parse an action token and call the corresponding Automation method.

        Returns a short outcome string for the Reviewer agent.
        Unrecognised tokens are logged as warnings and skipped.
        """
        parts  = action.split(maxsplit=1)
        token  = parts[0].upper() if parts else ""
        args   = parts[1] if len(parts) > 1 else ""
        outcome = ""

        try:
            if token == "CLICK":
                x, y = self._parse_xy(args)
                self._automation.click(x, y)
                outcome = f"Clicked at ({x}, {y})"

            elif token == "RIGHT_CLICK":
                x, y = self._parse_xy(args)
                self._automation.right_click(x, y)
                outcome = f"Right-clicked at ({x}, {y})"

            elif token == "TYPE":
                text = args.strip('"\'')
                self._automation.type_text(text)
                outcome = f"Typed: {text[:40]}"

            elif token == "RUN":
                cmd = args.strip('"\'')
                self._automation.run_command(cmd)
                outcome = f"Ran command: {cmd[:80]}"

            elif token == "PRESS":
                keys = args.split()
                self._automation.press_key(*keys)
                outcome = f"Pressed keys: {' + '.join(keys)}"

            elif token == "SCROLL":
                scroll_parts = args.split()
                clicks = int(scroll_parts[0]) if scroll_parts else 3
                sx = int(scroll_parts[1]) if len(scroll_parts) > 1 else None
                sy = int(scroll_parts[2]) if len(scroll_parts) > 2 else None
                self._automation.scroll(clicks, x=sx, y=sy)
                outcome = f"Scrolled {clicks} clicks"

            elif token == "OPEN_TERMINAL":
                self._automation.open_terminal()
                outcome = "Opened terminal"

            elif token == "WAIT":
                seconds = float(args) if args else 1.0
                logger.info("[Act] Waiting %.1f seconds...", seconds)
                time.sleep(seconds)
                outcome = f"Waited {seconds}s"

            elif token == "SCREENSHOT":
                if img is not None:
                    path = self._capture.save(
                        img, f"desktop_agent_frames/debug_{int(time.time())}.png"
                    )
                    logger.info("[Act] Screenshot saved to %s", path)
                    outcome = f"Screenshot saved to {path}"
                else:
                    outcome = "Screenshot requested (no image available)"

            else:
                logger.warning("[Act] Unrecognised action token: %r — skipping.", token)
                outcome = f"Unrecognised action: {token}"

        except Exception as exc:
            logger.error("[Act] Failed to execute %r: %s", action, exc, exc_info=True)
            outcome = f"Error: {exc}"

        return outcome

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_xy(args: str) -> tuple[int, int]:
        """Parse 'x y' or 'x,y' into (int, int)."""
        args = args.replace(",", " ")
        parts = args.split()
        if len(parts) < 2:
            raise ValueError(f"Expected 'x y' coordinates, got: {args!r}")
        return int(parts[0]), int(parts[1])


# ------------------------------------------------------------------
# CLI entry point
# ------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Desktop AI Agent — observe, decide, act."
    )
    parser.add_argument("--goal", required=True, help="High-level goal to achieve.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Log actions without executing them (safe for testing).")
    parser.add_argument("--max-cycles", type=int, default=100,
                        help="Maximum loop iterations (default: 100).")
    parser.add_argument("--fps", type=float, default=0.5,
                        help="Captures per second (default: 0.5).")
    parser.add_argument("--no-save", action="store_true",
                        help="Do not save debug screenshots to disk.")
    args = parser.parse_args()

    agent = DesktopController(
        goal=args.goal,
        dry_run=args.dry_run,
        max_cycles=args.max_cycles,
        fps=args.fps,
        save_dir=None if args.no_save else "desktop_agent_frames",
    )
    agent.run()


if __name__ == "__main__":
    main()
