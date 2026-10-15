"""
core/executor.py

Execution engine.

Two modes:
  run_code(source_code)   — write Python to a temp file and execute it
  run_file(file_path)     — execute an existing file with the system Python
  run_shell(command, cwd) — run an arbitrary shell command (npm, pnpm, tsc, etc.)

All functions return ExecutionResult(returncode, stdout, stderr).
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NamedTuple


class ExecutionResult(NamedTuple):
    returncode: int
    stdout:     str
    stderr:     str

    @property
    def ok(self) -> bool:
        """True when the command exited cleanly."""
        return self.returncode == 0

    def summary(self) -> str:
        """One-line summary for logging."""
        status = "OK" if self.ok else f"FAIL rc={self.returncode}"
        out = (self.stdout[:120] + "…") if len(self.stdout) > 120 else self.stdout
        err = (self.stderr[:120] + "…") if len(self.stderr) > 120 else self.stderr
        parts = [status]
        if out:
            parts.append(f"stdout: {out}")
        if err:
            parts.append(f"stderr: {err}")
        return " | ".join(parts)


# Work in the directory from which `camin` was launched.
_PROJECT_ROOT = Path.cwd().resolve()


# ── Run arbitrary shell command ──────────────────────────────────────────────

def run_shell(
    command: str | list[str],
    cwd:     str | None = None,
    timeout: int = 60,
    env:     dict | None = None,
) -> ExecutionResult:
    """
    Execute a shell command and capture its output.

    This is the primary execution interface for running dev servers,
    build tools, package managers, linters, and type-checkers.

    Parameters
    ----------
    command : Shell command as a string ("npm run build") or arg list
              (["pnpm", "--filter", "@workspace/api-server", "run", "dev"]).
              Strings are passed through the shell (shell=True); lists are not.
    cwd     : Working directory. Relative paths are resolved from the launch
              directory. Defaults to the launch directory if not specified.
    timeout : Maximum seconds to wait (default: 60).
    env     : Extra environment variables to add to the current environment.

    Returns
    -------
    ExecutionResult(returncode, stdout, stderr)
    """
    # Resolve working directory
    if cwd is None:
        work_dir = _PROJECT_ROOT
    else:
        work_dir = (_PROJECT_ROOT / cwd).resolve()

    # Merge environment
    exec_env = os.environ.copy()
    if env:
        exec_env.update(env)

    use_shell = isinstance(command, str)

    try:
        result = subprocess.run(
            command,
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=use_shell,
            env=exec_env,
        )
        return ExecutionResult(
            returncode=result.returncode,
            stdout=result.stdout.strip(),
            stderr=result.stderr.strip(),
        )
    except subprocess.TimeoutExpired:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Command timed out after {timeout}s: {command}",
        )
    except FileNotFoundError as exc:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Command not found: {exc}",
        )
    except Exception as exc:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Executor error: {exc}",
        )


# ── Python-specific helpers ──────────────────────────────────────────────────

def run_code(source_code: str, timeout: int = 30) -> ExecutionResult:
    """
    Write source_code to a temporary file and execute it with the system Python.

    Parameters
    ----------
    source_code : Valid Python source as a string.
    timeout     : Maximum seconds to wait before killing the process.

    Returns
    -------
    ExecutionResult with returncode, stdout, stderr.
    """
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".py",
        delete=False,
        encoding="utf-8",
    ) as tmp:
        tmp.write(source_code)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return ExecutionResult(
            returncode=result.returncode,
            stdout=result.stdout.strip(),
            stderr=result.stderr.strip(),
        )
    except subprocess.TimeoutExpired:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Execution timed out after {timeout} seconds.",
        )
    except Exception as exc:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Executor error: {exc}",
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def run_file(file_path: str, timeout: int = 30) -> ExecutionResult:
    """
    Execute an existing Python file by path.

    Parameters
    ----------
    file_path : Absolute or relative path to a .py file.
    timeout   : Maximum seconds to wait.

    Returns
    -------
    ExecutionResult with returncode, stdout, stderr.
    """
    if not os.path.exists(file_path):
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"File not found: {file_path}",
        )

    try:
        result = subprocess.run(
            [sys.executable, file_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return ExecutionResult(
            returncode=result.returncode,
            stdout=result.stdout.strip(),
            stderr=result.stderr.strip(),
        )
    except subprocess.TimeoutExpired:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Execution timed out after {timeout} seconds.",
        )
    except Exception as exc:
        return ExecutionResult(
            returncode=-1,
            stdout="",
            stderr=f"Executor error: {exc}",
        )
