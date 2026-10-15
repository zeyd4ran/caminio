"""
agents/planner.py

Planner Agent.

Analyses the goal and current memory state, then decides the single next
task — including which file to target and what kind of action to take.

Returns a structured dict so the orchestration loop can act without
further parsing:

    {
        "task":        "Add input validation to the login form",
        "target_file": "artifacts/taskflow/src/components/LoginForm.tsx",
        "action_type": "modify",   # "modify" | "create" | "execute" | "done"
        "notes":       "Check existing validation logic first."
    }

action_type values
------------------
  modify   – read an existing file and update it
  create   – create a new file (target_file is the path to create)
  execute  – run a shell command (task contains the command; no file needed)
  done     – goal is fully achieved; loop should stop
"""

from __future__ import annotations

from core.llm import call_llm_json
from core import memory


_SYSTEM_PROMPT = """You are a disciplined Planner agent inside a multi-agent software engineering system.

The system edits files directly — no mouse, no keyboard, no UI automation.

Your sole job is to decide the SINGLE next task that makes progress toward the goal.

Return a JSON object with exactly these keys:
{
  "task":        "Short, specific action sentence.",
  "target_file": "relative/path/from/project/root/to/file.ext",
  "action_type": "modify" | "create" | "execute" | "done",
  "notes":       "One sentence of context for the Coder, or empty string."
}

Rules:
1. One task per call only.
2. Do NOT write code.
3. Tasks must be small, incremental, and independently verifiable.
4. Consider completed tasks and recent errors before deciding.
5. Set action_type to "done" (and task to "DONE") when the goal is fully achieved.
6. Do not repeat completed tasks.
7. target_file must be a valid relative path for modify/create tasks.
8. For execute tasks, put the shell command in "task" and leave target_file empty.
9. Prefer editing existing files over creating new ones unless creation is essential.
10. IMPORTANT: Return ONLY the JSON object. No markdown, no preamble.
"""


def plan_next_task() -> dict[str, str]:
    """
    Inspect the current memory state and return a structured task plan.

    Returns
    -------
    dict with keys: task, target_file, action_type, notes
    If the goal is complete or no goal is set, returns action_type="done".
    """
    state = memory.load()
    goal = state["goal"]

    if not goal:
        return _done_plan()

    completed_text = "\n".join(f"- {t}" for t in state["completed"]) or "(none)"
    pending_text   = "\n".join(f"- {t}" for t in state["pending"])   or "(none)"
    errors_text    = "\n".join(f"- {e}" for e in state["errors"][-5:]) or "(none)"

    user_prompt = (
        f"Goal:\n{goal}\n\n"
        f"Already completed:\n{completed_text}\n\n"
        f"Pending (not yet started):\n{pending_text}\n\n"
        f"Recent errors:\n{errors_text}\n\n"
        "What is the single next task? Return the JSON plan."
    )

    try:
        result = call_llm_json(_SYSTEM_PROMPT, user_prompt)
        return _normalise(result)
    except Exception as exc:
        memory.record_error(f"Planner failed: {exc}")
        return _done_plan()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalise(raw: dict) -> dict[str, str]:
    action_type = str(raw.get("action_type", "modify")).lower()
    task = str(raw.get("task", "")).strip()

    if action_type == "done" or task.upper() == "DONE":
        return _done_plan()

    return {
        "task":        task,
        "target_file": str(raw.get("target_file", "")).strip(),
        "action_type": action_type,
        "notes":       str(raw.get("notes", "")).strip(),
    }


def _done_plan() -> dict[str, str]:
    return {
        "task":        "DONE",
        "target_file": "",
        "action_type": "done",
        "notes":       "",
    }
