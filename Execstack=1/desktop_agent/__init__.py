"""
desktop_agent/

A modular desktop automation AI system designed to observe, reason, and
act on a local machine in real time.

Intended to run on a local machine (Windows / macOS / Linux) with a display.
This package does NOT run inside a headless cloud environment.

Module overview:
  screen.py     — capture the display into image data
  vision.py     — extract text and context from captured images (OCR)
  automation.py — send keyboard and mouse commands to the OS
  controller.py — main perception → decision → action loop

Integration:
  The controller delegates planning to the multi-agent system in agents/.
  Import paths assume this package sits alongside the agents/ and core/ folders.
"""
