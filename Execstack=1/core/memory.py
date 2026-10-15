"""
core/memory.py

Persistent memory system.
Reads and writes memory.json in the directory where `camin` was launched.
Schema:
  {
    "goal":      str,
    "completed": [str, ...],
    "pending":   [str, ...],
    "errors":    [str, ...]
  }
"""

import json
import os
from typing import TypedDict

MEMORY_PATH = os.path.join(os.getcwd(), "memory.json")


class MemoryState(TypedDict):
    goal: str
    completed: list[str]
    pending: list[str]
    errors: list[str]


def load() -> MemoryState:
    """Load the current memory state from disk."""
    if not os.path.exists(MEMORY_PATH):
        return MemoryState(goal="", completed=[], pending=[], errors=[])

    with open(MEMORY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    return MemoryState(
        goal=data.get("goal", ""),
        completed=data.get("completed", []),
        pending=data.get("pending", []),
        errors=data.get("errors", []),
    )


def save(state: MemoryState) -> None:
    """Write the memory state to disk atomically."""
    tmp_path = MEMORY_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp_path, MEMORY_PATH)


def set_goal(goal: str) -> None:
    """Set the top-level goal and persist."""
    state = load()
    state["goal"] = goal
    save(state)


def mark_completed(task: str) -> None:
    """Move a task from pending to completed, avoiding duplicates."""
    state = load()
    if task in state["pending"]:
        state["pending"].remove(task)
    if task not in state["completed"]:
        state["completed"].append(task)
    save(state)


def add_pending(task: str) -> None:
    """Add a new pending task, avoiding duplicates."""
    state = load()
    if task not in state["pending"] and task not in state["completed"]:
        state["pending"].append(task)
    save(state)


def record_error(error: str) -> None:
    """Append an error entry."""
    state = load()
    state["errors"].append(error)
    save(state)


def clear_errors() -> None:
    """Remove all recorded errors."""
    state = load()
    state["errors"] = []
    save(state)
