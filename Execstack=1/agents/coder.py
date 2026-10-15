"""
agents/coder.py

Coder Agent.

Given a task description, the target file path, and the current file content,
the Coder returns a COMPLETE updated version of the file — not a patch, not a
snippet, the full file.

Two entry points:
  generate_code(task, context)
      Legacy interface — generates standalone Python code with no prior context.
      Used when action_type == "execute" or when creating a new Python script.

  edit_file(task, file_path, existing_content, notes)
      Primary interface — edits an existing file by producing its full replacement.
      Respects the original language, formatting, and structure.
"""

from __future__ import annotations

from core.llm import call_llm


# ── Edit existing file ───────────────────────────────────────────────────────

_EDIT_SYSTEM = """You are a disciplined Coder agent in a multi-agent software engineering system.

You receive:
  1. A task — a specific, minimal change to make to a file
  2. The file path — tells you the language and context
  3. The current complete content of the file

Your job: return the COMPLETE updated file content.

Rules:
1. Return ONLY the file content — no markdown fences, no explanations, no preamble.
2. The output must be a complete, valid, runnable file.
3. Make ONLY the change described in the task. Leave everything else intact.
4. Preserve all existing imports, formatting, logic, and structure.
5. If the file is TypeScript/React, return valid TypeScript/TSX.
6. If the file is Python, return valid Python including all original imports.
7. If the file is JSON/YAML, return valid JSON/YAML.
8. Never introduce syntax errors or break working code.
9. Never truncate the file — the output must include every line of the original
   that was not changed by this task.
"""


def edit_file(
    task:             str,
    file_path:        str,
    existing_content: str,
    notes:            str = "",
) -> str:
    """
    Generate a complete updated version of an existing file.

    Parameters
    ----------
    task             : What change to make (e.g. "Add error boundary to App component").
    file_path        : Relative path of the file (used for language context).
    existing_content : Current complete file content.
    notes            : Optional planner notes for extra context.

    Returns
    -------
    Complete updated file content as a string.
    """
    prompt_parts = [
        f"Task: {task}",
        f"File: {file_path}",
    ]
    if notes:
        prompt_parts.append(f"Notes: {notes}")
    prompt_parts.append(
        f"\nCurrent file content:\n```\n{existing_content}\n```"
        "\n\nReturn the complete updated file."
    )

    user_prompt = "\n".join(prompt_parts)
    raw = call_llm(_EDIT_SYSTEM, user_prompt, temperature=0.1).strip()
    return _strip_fences(raw)


# ── Create new file ──────────────────────────────────────────────────────────

_CREATE_SYSTEM = """You are a disciplined Coder agent in a multi-agent software engineering system.

You receive a task that requires creating a NEW file from scratch.

Your job: return the COMPLETE content of the new file.

Rules:
1. Return ONLY the file content — no markdown fences, no explanations.
2. The file must be complete, valid, and self-contained.
3. Include all necessary imports and boilerplate for the file type.
4. Follow the conventions of the file extension (TypeScript for .ts/.tsx, Python for .py, etc.)
5. The output must be ready to save to disk and use immediately.
"""


def create_file(task: str, file_path: str, notes: str = "") -> str:
    """
    Generate complete content for a brand-new file.

    Parameters
    ----------
    task      : What the file should contain/do.
    file_path : Target path (used to determine language/type).
    notes     : Optional planner context.

    Returns
    -------
    Complete new file content as a string.
    """
    prompt_parts = [f"Task: {task}", f"File to create: {file_path}"]
    if notes:
        prompt_parts.append(f"Notes: {notes}")
    prompt_parts.append("Return the complete file content.")

    user_prompt = "\n".join(prompt_parts)
    raw = call_llm(_CREATE_SYSTEM, user_prompt, temperature=0.15).strip()
    return _strip_fences(raw)


# ── Legacy: standalone code generation ──────────────────────────────────────

_GENERATE_SYSTEM = """You are a disciplined Coder agent inside a multi-agent software development system.

Your sole responsibility is to write working Python code for a given task.

Rules you must obey:
1. Return ONLY raw Python source code — no markdown, no code fences, no explanations.
2. The code must be complete and runnable as a standalone script.
3. Include all necessary imports at the top.
4. Follow clean, modular Python conventions.
5. Do not include any text before or after the code block.
6. Code must print its result or final status so output can be verified.
7. Handle exceptions gracefully within the code.
"""


def generate_code(task: str, context: str = "") -> str:
    """
    Generate standalone Python code for a task.
    Legacy entry point — used for execute-type tasks.

    Parameters
    ----------
    task    : What the script should do.
    context : Optional extra context (prior code, errors, etc.)

    Returns
    -------
    Raw Python source code.
    """
    user_prompt = f"Task: {task}"
    if context:
        user_prompt += f"\n\nAdditional context:\n{context}"

    raw = call_llm(_GENERATE_SYSTEM, user_prompt).strip()
    return _strip_fences(raw)


# ── Shared helper ────────────────────────────────────────────────────────────

def _strip_fences(code: str) -> str:
    """Remove markdown code fences if the LLM included them anyway."""
    lines = code.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)
