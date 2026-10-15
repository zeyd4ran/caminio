"""
desktop_agent/screen.py

Screen capture module.

Uses the `mss` library to grab one or more monitors and convert the raw
pixel data into a Pillow Image that other modules can process.

REQUIRES a live display (X11 / Wayland / Quartz / Win32).
Will raise mss.exception.ScreenShotError in headless environments.

Typical usage
-------------
    from desktop_agent.screen import Capture

    cap = Capture()
    img = cap.grab_primary()          # PIL.Image of the primary monitor
    img = cap.grab_region(0, 0, 1920, 1080)  # specific rectangle
    cap.save(img, "snapshot.png")     # write to disk for inspection
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

# mss is imported lazily so the module can be imported in headless environments
# without crashing — the error is raised only when capture is actually attempted.
try:
    import mss
    import mss.tools
    _MSS_AVAILABLE = True
except ImportError:
    _MSS_AVAILABLE = False

try:
    from PIL import Image
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False


@dataclass
class MonitorInfo:
    """Metadata describing a detected monitor."""
    index: int
    left: int
    top: int
    width: int
    height: int

    @property
    def region(self) -> dict[str, int]:
        """Return region dict compatible with mss."""
        return {
            "left":   self.left,
            "top":    self.top,
            "width":  self.width,
            "height": self.height,
        }


class Capture:
    """
    High-level screen capture interface.

    Wraps mss to provide:
    - Single-shot grabs of any monitor or custom region
    - Continuous capture loop with configurable FPS
    - Optional saving to disk for debugging

    Parameters
    ----------
    save_dir : str | Path, optional
        If provided, every captured frame is automatically saved here.
        Useful for debugging and building datasets.
    """

    def __init__(self, save_dir: str | Path | None = None) -> None:
        self._save_dir = Path(save_dir) if save_dir else None
        if self._save_dir:
            self._save_dir.mkdir(parents=True, exist_ok=True)
        self._frame_count = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def list_monitors(self) -> list[MonitorInfo]:
        """
        Return metadata for every monitor attached to the machine.

        Monitor index 0 is the virtual combined screen;
        monitor index 1+ are individual physical monitors.
        """
        self._require_mss()
        with mss.mss() as sct:
            return [
                MonitorInfo(
                    index=i,
                    left=m["left"],
                    top=m["top"],
                    width=m["width"],
                    height=m["height"],
                )
                for i, m in enumerate(sct.monitors)
            ]

    def grab_primary(self) -> "Image.Image":
        """
        Capture the primary monitor (index 1 in mss).

        Returns
        -------
        PIL.Image.Image
            RGBA image of the full primary monitor.
        """
        self._require_mss()
        self._require_pil()

        with mss.mss() as sct:
            # mss.monitors[0] is the combined virtual screen.
            # mss.monitors[1] is the first physical monitor (primary).
            primary = sct.monitors[1]
            raw = sct.grab(primary)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

        self._frame_count += 1
        if self._save_dir:
            self.save(img, self._save_dir / f"frame_{self._frame_count:06d}.png")

        return img

    def grab_region(
        self,
        left: int,
        top: int,
        width: int,
        height: int,
        monitor: int = 1,
    ) -> "Image.Image":
        """
        Capture a rectangular region on the specified monitor.

        Parameters
        ----------
        left, top   : pixel coordinates of the top-left corner
        width, height : dimensions of the region in pixels
        monitor     : which monitor to capture from (default: 1 = primary)

        Returns
        -------
        PIL.Image.Image
        """
        self._require_mss()
        self._require_pil()

        region = {"left": left, "top": top, "width": width, "height": height}

        with mss.mss() as sct:
            raw = sct.grab(region)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")

        return img

    def loop(
        self,
        fps: float = 1.0,
        max_frames: int | None = None,
    ) -> Iterator["Image.Image"]:
        """
        Generator that continuously yields screenshots at a fixed rate.

        Parameters
        ----------
        fps         : captures per second (default: 1.0)
        max_frames  : stop after this many frames; None means run forever.

        Usage
        -----
            cap = Capture()
            for frame in cap.loop(fps=2):
                process(frame)   # your processing here
        """
        interval = 1.0 / max(fps, 0.001)
        count = 0

        while max_frames is None or count < max_frames:
            start = time.perf_counter()
            yield self.grab_primary()
            count += 1

            elapsed = time.perf_counter() - start
            sleep_for = interval - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)

    @staticmethod
    def save(img: "Image.Image", path: str | Path) -> Path:
        """
        Save a PIL image to disk.

        Parameters
        ----------
        img  : the image to save
        path : destination file path (PNG recommended)

        Returns
        -------
        Path  the resolved absolute path
        """
        out = Path(path).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out)
        return out

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _require_mss() -> None:
        if not _MSS_AVAILABLE:
            raise ImportError(
                "mss is not installed. Run: pip install mss\n"
                "Note: mss requires a physical display — it will not work in "
                "headless cloud environments."
            )

    @staticmethod
    def _require_pil() -> None:
        if not _PIL_AVAILABLE:
            raise ImportError(
                "Pillow is not installed. Run: pip install Pillow"
            )
