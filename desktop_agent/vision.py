"""
desktop_agent/vision.py

Vision module — extracts structured text and context from screenshots.

Uses pytesseract (a Python wrapper around the Tesseract OCR engine) to
read text from PIL images captured by screen.py.

Also provides a ScreenContext dataclass that packages everything the
planner agent needs to decide the next action:
  - raw OCR text
  - detected application name (heuristic)
  - visible UI hints (errors, prompts, code)

REQUIRES:
  - Tesseract binary installed on the local machine
  - pytesseract Python package
  - Pillow

Tesseract installation:
  Windows : https://github.com/UB-Mannheim/tesseract/wiki
  macOS   : brew install tesseract
  Linux   : sudo apt install tesseract-ocr
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL import Image

try:
    import pytesseract
    _TESSERACT_AVAILABLE = True
except ImportError:
    _TESSERACT_AVAILABLE = False

try:
    from PIL import Image as _PilImage, ImageFilter, ImageOps
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False


# ------------------------------------------------------------------
# Data structures
# ------------------------------------------------------------------

@dataclass
class ScreenContext:
    """
    Structured representation of a captured screen frame.

    All agents receive this object as their primary input.

    Attributes
    ----------
    raw_text        : all text extracted via OCR (may be noisy)
    active_app      : best-guess name of the foreground application
    file            : detected filename / path visible in the editor title bar
    visible_code    : snippet of code visible in the editor (if any)
    ui_state        : description of the current UI state (e.g. "dialog open")
    intent_hint     : heuristic hint about what the user/system was doing
    has_error       : True if an error pattern was detected in the text
    has_prompt      : True if a shell/terminal prompt was detected
    has_code        : True if code-like patterns were detected
    error_lines     : specific lines that look like error messages
    summary         : one-sentence human-readable description for the planner
    """
    raw_text:     str = ""
    active_app:   str = "unknown"
    file:         str = ""
    visible_code: str = ""
    ui_state:     str = ""
    intent_hint:  str = ""
    has_error:    bool = False
    has_prompt:   bool = False
    has_code:     bool = False
    error_lines:  list[str] = field(default_factory=list)
    summary:      str = ""

    def to_prompt_string(self) -> str:
        """
        Format the context as a concise string suitable for LLM prompts.
        """
        parts = [f"Active application: {self.active_app}"]
        if self.file:
            parts.append(f"Open file: {self.file}")
        if self.ui_state:
            parts.append(f"UI state: {self.ui_state}")
        if self.intent_hint:
            parts.append(f"Intent hint: {self.intent_hint}")
        parts.append(f"Summary: {self.summary}")
        if self.error_lines:
            parts.append("Detected errors:")
            parts.extend(f"  - {e}" for e in self.error_lines[:5])
        if self.visible_code:
            parts.append(f"Visible code:\n{self.visible_code[:400]}")
        elif self.raw_text:
            snippet = self.raw_text[:600].replace("\n", " ").strip()
            parts.append(f"Visible text (truncated): {snippet}")
        return "\n".join(parts)

    def to_dict(self) -> dict[str, object]:
        """
        Return a plain dict — useful for memory storage and JSON serialisation.
        """
        return {
            "active_app":   self.active_app,
            "file":         self.file,
            "visible_code": self.visible_code[:400] if self.visible_code else "",
            "ui_state":     self.ui_state,
            "intent_hint":  self.intent_hint,
            "errors":       self.error_lines[:5],
            "has_error":    self.has_error,
            "has_prompt":   self.has_prompt,
            "has_code":     self.has_code,
            "summary":      self.summary,
        }


# ------------------------------------------------------------------
# Main vision class
# ------------------------------------------------------------------

class Vision:
    """
    Extracts text and infers context from a PIL screenshot image.

    Parameters
    ----------
    tesseract_cmd : str | None
        Path to the Tesseract binary if it is not on PATH.
        Example (Windows): r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
    lang : str
        Tesseract language code (default: "eng").
    """

    # Patterns used to classify the screen content
    _ERROR_PATTERNS = re.compile(
        r"\b(error|exception|traceback|failed|fatal|warning|undefined|"
        r"syntaxerror|typeerror|valueerror|cannot find|not found|denied)\b",
        re.IGNORECASE,
    )
    _PROMPT_PATTERNS = re.compile(r"[$#>]\s*$", re.MULTILINE)
    _CODE_PATTERNS   = re.compile(r"(def |import |class |function |const |let |var |=>|{|})")

    # Heuristic: map common window title fragments to application names
    _APP_HINTS: dict[str, str] = {
        "visual studio code": "VS Code",
        "vscode":             "VS Code",
        "code -":             "VS Code",
        "terminal":           "Terminal",
        "bash":               "Terminal",
        "cmd.exe":            "Command Prompt",
        "powershell":         "PowerShell",
        "chrome":             "Chrome",
        "firefox":            "Firefox",
        "safari":             "Safari",
        "finder":             "Finder",
        "explorer":           "File Explorer",
    }

    def __init__(
        self,
        tesseract_cmd: str | None = None,
        lang: str = "eng",
    ) -> None:
        self._lang = lang
        if tesseract_cmd and _TESSERACT_AVAILABLE:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(self, img: "Image.Image") -> ScreenContext:
        """
        Run OCR on a screenshot and return a structured ScreenContext.

        Parameters
        ----------
        img : PIL.Image.Image
            The screenshot to analyze.

        Returns
        -------
        ScreenContext
        """
        self._require_deps()

        processed = self._preprocess(img)
        raw_text  = self._ocr(processed)
        return self._build_context(raw_text)

    def extract_text(self, img: "Image.Image") -> str:
        """
        Return raw OCR text from an image with no further processing.
        Useful for quick checks or debugging.
        """
        self._require_deps()
        processed = self._preprocess(img)
        return self._ocr(processed)

    # ------------------------------------------------------------------
    # Internal — preprocessing
    # ------------------------------------------------------------------

    @staticmethod
    def _preprocess(img: "Image.Image") -> "Image.Image":
        """
        Improve OCR accuracy by converting to greyscale and sharpening.

        More aggressive preprocessing (binarisation, deskew) can be added
        here as needed for specific screen types.
        """
        grey = img.convert("L")                    # greyscale
        sharp = grey.filter(ImageFilter.SHARPEN)   # sharpen edges
        return sharp

    def _ocr(self, img: "Image.Image") -> str:
        """Run Tesseract OCR and return cleaned text."""
        raw = pytesseract.image_to_string(img, lang=self._lang)
        # Collapse excessive whitespace while preserving newlines
        lines = [line.strip() for line in raw.splitlines()]
        return "\n".join(line for line in lines if line)

    # ------------------------------------------------------------------
    # Internal — context building
    # ------------------------------------------------------------------

    # Regex to extract a filename from VS Code-style title bars.
    # Matches patterns like "index.ts — myproject" or "app.py - VS Code"
    _FILENAME_PATTERN = re.compile(
        r"\b([\w\-]+\.(py|ts|tsx|js|jsx|json|yaml|yml|md|sh|html|css|env))\b",
        re.IGNORECASE,
    )

    # Detect common UI state indicators
    _DIALOG_PATTERN  = re.compile(r"\b(dialog|modal|popup|confirm|alert|save as)\b", re.IGNORECASE)
    _LOADING_PATTERN = re.compile(r"\b(loading|compiling|building|installing|waiting)\b", re.IGNORECASE)

    def _build_context(self, raw_text: str) -> ScreenContext:
        """Classify raw OCR text into a full ScreenContext."""
        lines = raw_text.splitlines()

        error_lines  = [l for l in lines if self._ERROR_PATTERNS.search(l)]
        has_prompt   = bool(self._PROMPT_PATTERNS.search(raw_text))
        has_code     = bool(self._CODE_PATTERNS.search(raw_text))
        active_app   = self._guess_app(raw_text)
        file_name    = self._guess_file(raw_text)
        visible_code = self._extract_code(lines) if has_code else ""
        ui_state     = self._guess_ui_state(raw_text)
        intent_hint  = self._build_intent_hint(active_app, has_code, has_prompt, bool(error_lines))
        summary      = self._build_summary(active_app, bool(error_lines), has_prompt, has_code)

        return ScreenContext(
            raw_text=raw_text,
            active_app=active_app,
            file=file_name,
            visible_code=visible_code,
            ui_state=ui_state,
            intent_hint=intent_hint,
            has_error=bool(error_lines),
            has_prompt=has_prompt,
            has_code=has_code,
            error_lines=error_lines,
            summary=summary,
        )

    def _guess_app(self, text: str) -> str:
        """Heuristically identify the active application from visible text."""
        lower = text.lower()
        for hint, name in self._APP_HINTS.items():
            if hint in lower:
                return name
        return "unknown"

    def _guess_file(self, text: str) -> str:
        """Extract the most likely open filename from OCR text."""
        match = self._FILENAME_PATTERN.search(text)
        return match.group(0) if match else ""

    @staticmethod
    def _extract_code(lines: list[str]) -> str:
        """
        Pull lines that look like source code.
        Returns up to 20 lines joined as a string.
        """
        _CODE_LINE = re.compile(r"(def |import |class |function |const |let |var |=>|\{|\}|;$)")
        code_lines = [l for l in lines if _CODE_LINE.search(l)]
        return "\n".join(code_lines[:20])

    def _guess_ui_state(self, text: str) -> str:
        """Describe the current UI state from visible keywords."""
        if self._DIALOG_PATTERN.search(text):
            return "dialog or modal visible"
        if self._LOADING_PATTERN.search(text):
            return "loading or building"
        if self._PROMPT_PATTERNS.search(text):
            return "terminal ready"
        return "idle"

    @staticmethod
    def _build_intent_hint(
        app: str,
        has_code: bool,
        has_prompt: bool,
        has_error: bool,
    ) -> str:
        """Infer what the user or system was doing."""
        if has_error:
            return "debugging or error recovery"
        if has_prompt and not has_code:
            return "running terminal commands"
        if has_code and app in ("VS Code", "unknown"):
            return "editing source code"
        if app in ("Chrome", "Firefox", "Safari"):
            return "browsing or reviewing documentation"
        return "general desktop use"

    @staticmethod
    def _build_summary(
        app: str,
        has_error: bool,
        has_prompt: bool,
        has_code: bool,
    ) -> str:
        parts = [f"{app} is visible."]
        if has_error:
            parts.append("An error is present on screen.")
        if has_prompt:
            parts.append("A terminal prompt is visible.")
        if has_code:
            parts.append("Code is visible in the editor.")
        return " ".join(parts)

    # ------------------------------------------------------------------
    # Dependency guards
    # ------------------------------------------------------------------

    @staticmethod
    def _require_deps() -> None:
        missing = []
        if not _TESSERACT_AVAILABLE:
            missing.append("pytesseract (pip install pytesseract)")
        if not _PIL_AVAILABLE:
            missing.append("Pillow (pip install Pillow)")
        if missing:
            raise ImportError(
                "Missing dependencies for vision module:\n"
                + "\n".join(f"  - {m}" for m in missing)
                + "\nAlso ensure the Tesseract binary is installed on your system."
            )
