"""
agents/debugger.py

Debugger Agent.

Two entry points:

  fix_file(task, file_path, existing_content, error_output)
      Primary interface — given a file and the error it caused, return
      the complete corrected file content.

  fix_code(original_code, error_output, task)
      Legacy interface — used when the broken code is a standalone script
      not tied to a specific project file.

Rules:
  - Fix ROOT CAUSES, not symptoms.
  - Return COMPLETE file content, not snippets.
  - Preserve all working code that is unrelated to the error.
  - Never introduce new bugs while fixing existing ones.
"""

from __future__ import annotations

from core.llm import call_llm


# ── Fix existing project file ────────────────────────────────────────────────

_FILE_FIX_SYSTEM = """You are a disciplined Debugger agent in a multi-agent software engineering system.

You receive:
  1. The file path (tells you the language)
  2. The current content of a file that is causing errors
  3. The error output from running/building the project
  4. The task that was being attempted when the error occurred

Your job: return the COMPLETE corrected file content.

Rules:
1. Return ONLY the file content — no markdown fences, no preamble, no explanation.
2. The output must be a complete, valid file (not a patch or snippet).
3. Analyse the error carefully — fix the ROOT CAUSE, not the symptom.
4. Preserve all working code that is unrelated to the error.
5. Keep all original imports, structure, and formatting intact.
6. Never truncate the file — the output must be a full replacement.
7. Never introduce new errors while fixing existing ones.
8. If the error is in a dependency or import, resolve it correctly.
"""


def fix_file(
    task:             str,
    file_path:        str,
    existing_content: str,
    error_output:     str,
) -> str:
    """
    Return a corrected complete version of a file that caused an error.

    Parameters
    ----------
    task             : The original task being attempted.
    file_path        : Relative path of the file (for language context).
    existing_content : Current (broken) file content.
    error_output     : stderr / build output from the failure.

    Returns
    -------
    Complete corrected file content.
    """
    user_prompt = (
        f"Task being attempted: {task}\n"
        f"File: {file_path}\n\n"
        f"Failing file content:\n```\n{existing_content}\n```\n\n"
        f"Error output:\n{error_output[:2000]}\n\n"
        "Return the complete corrected file."
    )
    raw = call_llm(_FILE_FIX_SYSTEM, user_prompt, temperature=0.05).strip()
    return _strip_fences(raw)


# ── Legacy: fix standalone Python script ─────────────────────────────────────

_SCRIPT_FIX_SYSTEM = """You are a disciplined Debugger agent inside a multi-agent software development system.

Your sole responsibility is to fix broken Python code.

Rules you must obey:
1. Carefully analyze the error message and traceback.
2. Identify the ROOT CAUSE — do not apply superficial patches.
3. Return ONLY the corrected Python source code — no markdown fences, no explanations.
4. The fixed code must be complete and runnable as a standalone script.
5. Preserve the original intent of the code while resolving the error.
6. Include all necessary imports.
7. Do not introduce new bugs while fixing existing ones.
"""


def fix_code(
    original_code: str,
    error_output:  str,
    task:          str = "",
) -> str:
    """
    Fix a broken standalone Python script.
    Legacy interface — used by the original executor-based flow.

    Parameters
    ----------
    original_code : The Python source that failed.
    error_output  : The stderr / traceback from the failed execution.
    task          : Optional original task description for context.

    Returns
    -------
    Corrected Python source code.
    """
    user_prompt = _build_legacy_prompt(original_code, error_output, task)
    raw = call_llm(_SCRIPT_FIX_SYSTEM, user_prompt).strip()
    return _strip_fences(raw)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _build_legacy_prompt(code: str, error: str, task: str) -> str:
    parts = []
    if task:
        parts.append(f"Original task: {task}\n")
    parts.append(f"Failing code:\n{code}\n")
    parts.append(f"Error output:\n{error}\n")
    parts.append("Provide the complete corrected code.")
    return "\n".join(parts)


def _strip_fences(code: str) -> str:
    """Remove markdown code fences if the LLM included them anyway."""
    lines = code.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)
