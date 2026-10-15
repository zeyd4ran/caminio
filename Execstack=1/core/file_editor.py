"""
core/file_editor.py

Safe file-system layer for the agent system.

All paths are resolved relative to the directory where `camin` was launched.
Directory traversal (../ etc.) is rejected with a ValueError.

Public API
----------
read_file(path)                     → str
write_file(path, content)           → None  (atomic write)
append_file(path, content)          → None
list_files(directory, pattern)      → list[str]   (relative to PROJECT_ROOT)
backup_file(path)                   → str          (returns backup path)
file_exists(path)                   → bool
"""

from __future__ import annotations

import fnmatch
import os
import shutil
from pathlib import Path

# Anchor everything to the directory from which `camin` was launched.
PROJECT_ROOT = Path.cwd().resolve()


# ── Path resolution ──────────────────────────────────────────────────────────

def _safe_resolve(rel_path: str) -> Path:
    """
    Resolve rel_path relative to PROJECT_ROOT.

    Raises ValueError if the resolved path escapes the project root
    (directory traversal attack).
    """
    # Normalise separators and strip leading slashes so Path() doesn't treat
    # it as absolute.
    clean = rel_path.lstrip("/\\")
    resolved = (PROJECT_ROOT / clean).resolve()

    if not str(resolved).startswith(str(PROJECT_ROOT)):
        raise ValueError(
            f"Path traversal rejected: {rel_path!r} resolves outside project root."
        )
    return resolved


# ── File operations ──────────────────────────────────────────────────────────

def read_file(path: str, encoding: str = "utf-8") -> str:
    """
    Read a file and return its content as a string.

    Parameters
    ----------
    path : relative path from the project root (e.g. "artifacts/taskflow/src/App.tsx")

    Returns
    -------
    File content as a string.

    Raises
    ------
    FileNotFoundError : if the file does not exist
    ValueError        : if the path escapes the project root
    """
    resolved = _safe_resolve(path)
    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {path!r} (resolved: {resolved})")
    if not resolved.is_file():
        raise IsADirectoryError(f"Path is a directory, not a file: {path!r}")
    return resolved.read_text(encoding=encoding)


def write_file(path: str, content: str, encoding: str = "utf-8") -> None:
    """
    Write content to a file atomically (write → rename).

    Creates parent directories if they do not exist.
    Never deletes existing files; always overwrites in place.

    Parameters
    ----------
    path    : relative path from the project root
    content : complete file content to write
    """
    resolved = _safe_resolve(path)
    resolved.parent.mkdir(parents=True, exist_ok=True)

    # Atomic write: write to a temp file then rename
    tmp = resolved.with_suffix(resolved.suffix + ".tmp")
    try:
        tmp.write_text(content, encoding=encoding)
        os.replace(tmp, resolved)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise


def append_file(path: str, content: str, encoding: str = "utf-8") -> None:
    """
    Append content to an existing file.
    Creates the file (and any parent directories) if it does not yet exist.

    Parameters
    ----------
    path    : relative path from the project root
    content : text to append
    """
    resolved = _safe_resolve(path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    with resolved.open("a", encoding=encoding) as f:
        f.write(content)


def list_files(
    directory: str = ".",
    pattern: str = "*",
    recursive: bool = True,
) -> list[str]:
    """
    List files under directory that match glob pattern.

    Parameters
    ----------
    directory : path relative to project root (default: project root)
    pattern   : fnmatch-style glob pattern (default: "*" = all files)
    recursive : if True (default), walk sub-directories

    Returns
    -------
    Sorted list of paths relative to PROJECT_ROOT.
    Directories are excluded; only files are returned.
    """
    resolved = _safe_resolve(directory)
    if not resolved.is_dir():
        raise NotADirectoryError(f"Not a directory: {directory!r}")

    results: list[str] = []

    if recursive:
        for root, _dirs, files in os.walk(resolved):
            for name in files:
                if fnmatch.fnmatch(name, pattern):
                    abs_path = Path(root) / name
                    results.append(str(abs_path.relative_to(PROJECT_ROOT)))
    else:
        for entry in resolved.iterdir():
            if entry.is_file() and fnmatch.fnmatch(entry.name, pattern):
                results.append(str(entry.relative_to(PROJECT_ROOT)))

    return sorted(results)


def backup_file(path: str) -> str:
    """
    Create a timestamped backup of a file before modifying it.

    The backup is placed next to the original with a `.bak` extension.
    If the file does not exist, this is a no-op and returns "".

    Parameters
    ----------
    path : relative path from the project root

    Returns
    -------
    Relative path of the backup file, or "" if the source did not exist.
    """
    resolved = _safe_resolve(path)
    if not resolved.exists():
        return ""

    backup = resolved.with_suffix(resolved.suffix + ".bak")
    shutil.copy2(resolved, backup)
    return str(backup.relative_to(PROJECT_ROOT))


def file_exists(path: str) -> bool:
    """Return True if path exists and is a regular file."""
    try:
        resolved = _safe_resolve(path)
        return resolved.is_file()
    except ValueError:
        return False
