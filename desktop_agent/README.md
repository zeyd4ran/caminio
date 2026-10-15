# Desktop Agent

A modular desktop automation AI that observes your screen, reasons about what to do next, and controls the keyboard and mouse — designed to run locally on your own machine.

---

## How it works

```
Screenshot → OCR (Tesseract) → LLM Planner → Action (pyautogui)
    ↑                                                    |
    └────────────────── loop ────────────────────────────┘
```

Each cycle:
1. **Observe** — capture the primary monitor with `mss`
2. **Orient** — extract visible text with Tesseract OCR
3. **Decide** — ask the LLM planner for the next single action
4. **Act** — execute the action with `pyautogui`

---

## Requirements

### System dependencies

| Tool | Purpose | Install |
|------|---------|---------|
| Python 3.10+ | Runtime | [python.org](https://python.org) |
| Tesseract OCR | Read screen text | See below |

**Tesseract installation:**

| OS | Command |
|----|---------|
| Windows | Download installer from [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) |
| macOS | `brew install tesseract` |
| Linux | `sudo apt install tesseract-ocr` |

### Python packages

```bash
pip install -r desktop_agent/requirements.txt
```

Packages installed:
- `mss` — fast cross-platform screen capture
- `Pillow` — image processing
- `pytesseract` — Python wrapper for Tesseract OCR
- `pyautogui` — keyboard and mouse automation
- `openai` — LLM calls (shared with the multi-agent core)

---

## Running in VS Code

### 1. Clone / open the project

```bash
code .
```

### 2. Set your OpenAI API key

```bash
# Windows PowerShell
$env:OPENAI_API_KEY = "sk-..."

# macOS / Linux
export OPENAI_API_KEY="sk-..."
```

Or create a `.env` file and load it with `python-dotenv`.

### 3. Run with `--dry-run` first (safe — no actions executed)

```bash
python -m desktop_agent.controller --goal "Open VS Code and create hello.py" --dry-run
```

Review the logged actions in the terminal. When satisfied, remove `--dry-run`.

### 4. Run for real

```bash
python -m desktop_agent.controller --goal "Open VS Code and create hello.py"
```

### All CLI options

```
--goal          Required. High-level goal for the agent.
--dry-run       Log actions without executing them.
--max-cycles    Max loop iterations (default: 100).
--fps           Captures per second (default: 0.5).
--no-save       Do not save debug screenshots to desktop_agent_frames/.
```

---

## Integration with the multi-agent system

The controller uses the shared LLM wrapper from `core/llm.py`.

Configure the LLM via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | API key |
| `LLM_BASE_URL` | OpenAI | Override for Ollama / other providers |
| `LLM_MODEL` | `gpt-4o-mini` | Model name |

To use a local model (e.g., Ollama running `llama3`):

```bash
export LLM_BASE_URL=http://localhost:11434/v1
export LLM_API_KEY=ollama
export LLM_MODEL=llama3
```

---

## Project structure

```
desktop_agent/
  __init__.py     — package description
  screen.py       — screen capture (mss + Pillow)
  vision.py       — OCR and context extraction (Tesseract)
  automation.py   — keyboard/mouse control (pyautogui)
  controller.py   — main observe → decide → act loop
  requirements.txt
  README.md       — this file
```

---

## Warnings and risks

> **Read carefully before running without `--dry-run`.**

| Risk | Description |
|------|-------------|
| **Runaway actions** | The agent can type, click, and run commands autonomously. A bad LLM response could cause unintended actions. |
| **Data loss** | If the agent runs a `rm`, `del`, or similar command it will execute it without prompting. |
| **FailSafe** | Move the mouse to the **top-left corner** of the screen instantly to abort `pyautogui` and stop all actions. |
| **Max cycles** | The `--max-cycles` flag is a hard safety cap. Default is 100 — adjust carefully. |
| **API costs** | Each cycle makes one LLM call. At 0.5 FPS and 100 cycles this is ~100 API requests. |

**Best practices:**
- Always test with `--dry-run` first
- Keep `--fps` low (0.5 or lower) to reduce costs and risk
- Monitor the terminal output during the run
- Keep the Tesseract / system terminal on a secondary monitor if possible
- Never run as root / Administrator

---

## Extending the system

- **Add action types** — extend the `_execute` method in `controller.py` and update `PLANNER_SYSTEM` with the new token.
- **Improve OCR accuracy** — add binarisation or deskewing steps in `vision.py`.
- **Add memory** — pass `core/memory.py` into the controller to persist goals and completed steps across runs.
- **Use a local model** — set `LLM_BASE_URL` to point at an Ollama instance for fully offline operation.
