"""
agent_loop.py

Central Orchestration Loop — File-Based Engineering Mode.
Entry point: python agent_loop.py "your goal here"

Each iteration follows the pattern:
  READ → MODIFY → WRITE → EXECUTE → VALIDATE → REVIEW

Flow per iteration:
  1.  Planner selects task + target file + action type
  2.  For modify/create: read existing content (if any)
  3.  Coder generates the COMPLETE updated file content
  4.  Backup the original file
  5.  Write the new content to disk
  6.  Validate: run the project's check command
  7.  If validation fails:
        a. Debugger reads error + file, generates fix
        b. Write fix to disk
        c. Re-validate (up to MAX_RETRIES times)
  8.  For execute tasks: run the shell command directly
  9.  Update memory (completed / errors)
  10. Repeat until Planner returns "done"

Safety limits:
  MAX_ITERATIONS  – total loop iterations before forced stop
  MAX_RETRIES     – debug-and-retry attempts per task (default 2)
"""

from __future__ import annotations

import argparse
import os
import sys

from core import memory
from core.executor    import run_shell, run_code, run_file, ExecutionResult
from core.file_editor import (
    read_file, write_file, list_files, backup_file, file_exists,
)
from agents.planner  import plan_next_task
from agents.coder    import edit_file, create_file, generate_code
from agents.debugger import fix_file, fix_code


MAX_ITERATIONS = int(os.environ.get("MAX_ITERATIONS", "20"))
MAX_RETRIES    = int(os.environ.get("MAX_RETRIES",    "2"))
SEPARATOR      = "=" * 60

# Default validation command — runs TypeScript type-check + Python syntax check.
# Override with the VALIDATE_CMD environment variable for custom projects.
_DEFAULT_VALIDATE_CMD = os.environ.get(
    "VALIDATE_CMD",
    "echo 'no validate command configured'",
)


# ── Logging ──────────────────────────────────────────────────────────────────

def _log(label: str, text: str = "") -> None:
    print(f"\n{SEPARATOR}")
    print(f"  {label}")
    if text:
        print(SEPARATOR)
        print(text[:1000])   # cap output to keep logs readable
    print(SEPARATOR)


def _step(agent: str, msg: str) -> None:
    print(f"[{agent}] {msg}")


# ── Validation ───────────────────────────────────────────────────────────────

def _validate(target_file: str = "") -> ExecutionResult:
    """
    Run the project validation command.

    For Python files we syntax-check with py_compile.
    For TypeScript/JavaScript files we run tsc --noEmit on the workspace.
    A generic fallback runs the VALIDATE_CMD environment variable.
    """
    if target_file.endswith(".py"):
        return run_shell([sys.executable, "-m", "py_compile", target_file])

    if target_file.endswith((".ts", ".tsx")):
        return run_shell(
            "pnpm tsc --noEmit --project artifacts/taskflow/tsconfig.json",
        )

    # Generic / configured fallback
    return run_shell(_DEFAULT_VALIDATE_CMD)


# ── File operation handlers ──────────────────────────────────────────────────

def _handle_modify(task: dict[str, str]) -> tuple[bool, str]:
    """
    Read → Coder → Backup → Write → Validate → (debug loop).

    Returns (success, final_content).
    """
    file_path = task["target_file"]
    task_desc = task["task"]
    notes     = task["notes"]

    # Step 2: Read existing content (empty string for new files)
    existing = ""
    if file_exists(file_path):
        try:
            existing = read_file(file_path)
            _step("FileEditor", f"Read {len(existing)} chars from {file_path}")
        except Exception as exc:
            _step("FileEditor", f"Could not read {file_path}: {exc}")
    else:
        _step("FileEditor", f"File not found — will create: {file_path}")

    # Step 3: Coder generates complete updated content
    _step("Coder", f"Generating updated content for {file_path}...")
    new_content = edit_file(
        task=task_desc,
        file_path=file_path,
        existing_content=existing,
        notes=notes,
    )

    if not new_content.strip():
        _step("Coder", "ERROR: Coder returned empty content — skipping.")
        return False, ""

    # Step 4: Backup
    bak = backup_file(file_path)
    if bak:
        _step("FileEditor", f"Backup created: {bak}")

    # Step 5: Write
    write_file(file_path, new_content)
    _step("FileEditor", f"Wrote {len(new_content)} chars to {file_path}")

    # Step 6: Validate
    current_content = new_content
    for attempt in range(1, MAX_RETRIES + 2):
        _step("Executor", f"Validating {file_path} (attempt {attempt})...")
        result = _validate(file_path)

        if result.ok:
            _step("Executor", f"Validation passed: {result.summary()}")
            return True, current_content

        _step("Executor", f"Validation failed: {result.summary()}")

        if attempt > MAX_RETRIES:
            _step("Debugger", "Max retries reached — giving up on this task.")
            return False, current_content

        # Step 7: Debugger
        error_text = (result.stderr or result.stdout)[:2000]
        _step("Debugger", f"Analyzing error (retry {attempt}/{MAX_RETRIES})...")

        fixed = fix_file(
            task=task_desc,
            file_path=file_path,
            existing_content=current_content,
            error_output=error_text,
        )

        if not fixed.strip():
            _step("Debugger", "Debugger returned empty fix — aborting retries.")
            return False, current_content

        write_file(file_path, fixed)
        _step("Debugger", f"Fixed content written to {file_path}")
        current_content = fixed

    return False, current_content


def _handle_create(task: dict[str, str]) -> tuple[bool, str]:
    """
    Create a new file from scratch.
    Uses the same write → validate → debug loop as _handle_modify.
    """
    file_path = task["target_file"]
    task_desc = task["task"]
    notes     = task["notes"]

    _step("Coder", f"Creating new file: {file_path}...")
    content = create_file(task=task_desc, file_path=file_path, notes=notes)

    if not content.strip():
        _step("Coder", "ERROR: Coder returned empty content — skipping.")
        return False, ""

    write_file(file_path, content)
    _step("FileEditor", f"Created {file_path} ({len(content)} chars)")

    # Validate + debug loop (reuse modify handler logic from here)
    current_content = content
    for attempt in range(1, MAX_RETRIES + 2):
        result = _validate(file_path)
        if result.ok:
            _step("Executor", f"Validation passed: {result.summary()}")
            return True, current_content

        _step("Executor", f"Validation failed (attempt {attempt}): {result.summary()}")

        if attempt > MAX_RETRIES:
            _step("Debugger", "Max retries reached.")
            return False, current_content

        error_text = (result.stderr or result.stdout)[:2000]
        fixed = fix_file(
            task=task_desc,
            file_path=file_path,
            existing_content=current_content,
            error_output=error_text,
        )
        if not fixed.strip():
            return False, current_content

        write_file(file_path, fixed)
        _step("Debugger", f"Fix written to {file_path}")
        current_content = fixed

    return False, current_content


def _handle_execute(task: dict[str, str]) -> tuple[bool, str]:
    """
    Run a shell command directly.
    The task string IS the command (e.g. "pnpm install" or "python3.11 script.py").
    """
    command   = task["task"]
    notes     = task["notes"]
    generated = ""

    # If the command starts with "PYTHON:", generate and run a script.
    if command.upper().startswith("PYTHON:"):
        script_task = command[7:].strip()
        _step("Coder", f"Generating Python script: {script_task}")
        generated = generate_code(script_task, context=notes)
        if not generated.strip():
            _step("Coder", "Empty script — skipping.")
            return False, ""

        code_path = "generated_code.py"
        write_file(code_path, generated)
        _step("Executor", f"Running {code_path}...")
        result = run_file(code_path)
    else:
        _step("Executor", f"Running shell command: {command}")
        result = run_shell(command)

    if result.stdout:
        _step("Executor", f"stdout: {result.stdout[:500]}")
    if result.stderr:
        _step("Executor", f"stderr: {result.stderr[:500]}")

    if not result.ok and generated:
        _step("Debugger", "Command failed — attempting fix...")
        error_text = (result.stderr or result.stdout)[:2000]
        for attempt in range(1, MAX_RETRIES + 1):
            fixed = fix_code(
                original_code=generated,
                error_output=error_text,
                task=command,
            )
            if not fixed.strip():
                break
            write_file("generated_code.py", fixed)
            result = run_file("generated_code.py")
            if result.ok:
                _step("Executor", f"Fixed and succeeded on attempt {attempt}")
                return True, fixed
        return False, generated

    return result.ok, generated


# ── Main loop ────────────────────────────────────────────────────────────────

def run_loop(goal: str) -> None:
    """
    Main file-based engineering loop.

    Args:
        goal: High-level objective (e.g. "Add rate limiting to the API server").
    """
    memory.set_goal(goal)
    memory.clear_errors()

    _log("GOAL", goal)
    _log(
        "Starting file-based agent loop",
        f"Max iterations: {MAX_ITERATIONS}  |  Max retries: {MAX_RETRIES}",
    )

    for iteration in range(1, MAX_ITERATIONS + 1):
        _log(f"ITERATION {iteration}")

        # ── 1. Plan ───────────────────────────────────────────────────
        _step("Planner", "Deciding next task...")
        task = plan_next_task()

        action_type = task.get("action_type", "done")
        task_desc   = task.get("task", "")

        if action_type == "done" or not task_desc or task_desc.upper() == "DONE":
            _log("GOAL COMPLETE", "The planner reports all tasks are done.")
            break

        _step("Planner", f"Task: {task_desc}")
        if task.get("target_file"):
            _step("Planner", f"Target: {task['target_file']}  ({action_type})")
        if task.get("notes"):
            _step("Planner", f"Notes: {task['notes']}")

        memory.add_pending(task_desc)

        # ── 2–7. Dispatch by action type ──────────────────────────────
        if action_type in ("modify",):
            success, _ = _handle_modify(task)

        elif action_type == "create":
            success, _ = _handle_create(task)

        elif action_type == "execute":
            success, _ = _handle_execute(task)

        else:
            _step("Loop", f"Unknown action_type {action_type!r} — skipping.")
            success = False

        # ── 8. Update memory ──────────────────────────────────────────
        if success:
            memory.mark_completed(task_desc)
            _step("Memory", f"Completed: {task_desc}")
        else:
            error_summary = f"Task failed: {task_desc}"
            memory.record_error(error_summary)
            _step("Memory", f"Error recorded: {error_summary}")

    else:
        _log("LOOP LIMIT REACHED", f"Stopped after {MAX_ITERATIONS} iterations.")

    # ── Final summary ─────────────────────────────────────────────────
    state = memory.load()
    completed_lines = "\n".join(f"  + {t}" for t in state["completed"]) or "  (none)"
    pending_lines   = "\n".join(f"  ~ {t}" for t in state["pending"])   or "  (none)"
    error_lines     = "\n".join(f"  x {e}" for e in state["errors"])    or "  (none)"

    _log(
        "FINAL MEMORY STATE",
        f"Completed ({len(state['completed'])}):\n{completed_lines}"
        + (f"\n\nPending ({len(state['pending'])}):\n{pending_lines}" if state["pending"] else "")
        + (f"\n\nErrors ({len(state['errors'])}):\n{error_lines}"     if state["errors"]  else ""),
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="File-based multi-agent engineering loop."
    )
    parser.add_argument(
        "goal",
        nargs="?",
        default="",
        help="The high-level goal for the agent system to achieve.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from the existing memory.json goal instead of setting a new one.",
    )
    parser.add_argument(
        "--list-files",
        metavar="DIR",
        default="",
        help="List files under DIR (relative to project root) and exit.",
    )
    args = parser.parse_args()

    if args.list_files:
        files = list_files(args.list_files)
        print(f"\nFiles under {args.list_files!r}:")
        for f in files:
            print(f"  {f}")
        return

    if args.resume:
        state = memory.load()
        goal = state["goal"]
        if not goal:
            print("ERROR: --resume specified but memory.json has no goal set.")
            sys.exit(1)
        print(f"[Memory] Resuming goal: {goal}")
    else:
        goal = args.goal
        if not goal:
            print('Usage: python agent_loop.py "your goal"')
            print("       python agent_loop.py --resume")
            sys.exit(1)

    run_loop(goal)


if __name__ == "__main__":
    main()
