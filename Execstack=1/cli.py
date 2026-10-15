"""Rich terminal interface for the CAMIN engineering agent."""

from __future__ import annotations

import os
import shlex
from pathlib import Path

from dotenv import load_dotenv
from prompt_toolkit import PromptSession
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.document import Document
from prompt_toolkit.formatted_text import HTML, FormattedText
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.styles import Style
from pyfiglet import Figlet
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text


DEFAULT_MODEL = "qwen3.5:4b"
DEFAULT_PROVIDER = "Ollama"
DEFAULT_BASE_URL = "http://localhost:11434/v1"
DEFAULT_API_KEY = "ollama"
COMMANDS = (
    ("/help", "Show available commands"),
    ("/resume", "Resume the saved goal"),
    ("/files ", "List files under a directory"),
    ("/clear", "Clear the terminal"),
    ("/exit", "Exit CAMIN"),
    ("/model", "Change the active model"),
)

PALETTE = ((79, 172, 254), (167, 107, 216), (224, 96, 126))


def configure_agent_environment(env_file: Path | None = None) -> tuple[str, str]:
    """Load settings from the launch directory and adapt legacy variable names."""
    dotenv_path = env_file or Path.cwd() / ".env"
    load_dotenv(dotenv_path=dotenv_path, override=False)

    aliases = {
        "LLM_API_KEY": ("AI_INTEGRATIONS_OPENAI_API_KEY", "OPENAI_API_KEY"),
        "LLM_BASE_URL": ("AI_INTEGRATIONS_OPENAI_BASE_URL", "OPENAI_BASE_URL"),
        "LLM_MODEL": ("OPENAI_MODEL",),
    }
    for target, sources in aliases.items():
        if os.environ.get(target):
            continue
        for source in sources:
            value = os.environ.get(source)
            if value:
                os.environ[target] = value
                break

    base_url = (
        os.environ.get("OPENAI_BASE_URL")
        or os.environ.get("LLM_BASE_URL")
        or DEFAULT_BASE_URL
    )
    api_key = (
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("LLM_API_KEY")
        or DEFAULT_API_KEY
    )
    model = os.environ.get("OPENAI_MODEL") or os.environ.get("LLM_MODEL") or DEFAULT_MODEL

    os.environ["OPENAI_BASE_URL"] = base_url
    os.environ["LLM_BASE_URL"] = base_url
    os.environ["OPENAI_API_KEY"] = api_key
    os.environ["LLM_API_KEY"] = api_key
    os.environ["OPENAI_MODEL"] = model
    os.environ["LLM_MODEL"] = model
    provider = os.environ.get("AGENT_PROVIDER") or (
        DEFAULT_PROVIDER
        if base_url.rstrip("/") == DEFAULT_BASE_URL
        else "OpenAI-compatible"
    )
    return model, provider


def has_llm_configuration() -> bool:
    """Return whether a key or custom API endpoint is configured."""
    return bool(
        os.environ.get("LLM_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("LLM_BASE_URL")
    )


def _gradient_color(position: float) -> tuple[int, int, int]:
    """Interpolate the logo color from blue through purple to pink."""
    if position <= 0.5:
        start, end, amount = PALETTE[0], PALETTE[1], position * 2
    else:
        start, end, amount = PALETTE[1], PALETTE[2], (position - 0.5) * 2
    return tuple(round(left + (right - left) * amount) for left, right in zip(start, end))


def make_logo() -> Text:
    """Render CAMIN as per-character rich text with a horizontal RGB gradient."""
    rows = Figlet(font="ansi_shadow").renderText("CAMIN").rstrip("\n").splitlines()
    width = max((len(row) for row in rows), default=1)
    logo = Text()

    for row_index, row in enumerate(rows):
        for column, character in enumerate(row):
            position = column / max(width - 1, 1)
            red, green, blue = _gradient_color(position)
            logo.append(character, style=f"rgb({red},{green},{blue})")
        if row_index < len(rows) - 1:
            logo.append("\n")
    return logo


def make_style() -> Style:
    return Style.from_dict(
        {
            "prompt": "#4facfe bold",
            "confirm": "#4facfe bold",
            "placeholder": "#888888",
            "completion-menu": "bg:#20212c #dedee8",
            "completion-menu.completion": "bg:#20212c #dedee8",
            "completion-menu.completion.current": "bg:#4facfe #11111b",
            "completion-menu.meta": "bg:#20212c #aaaaaa",
            "completion-menu.meta.current": "bg:#4facfe #11111b",
            "toolbar-location": "bg:#20212c #e0607e",
            "toolbar-mode": "bg:#20212c #4facfe",
            "toolbar-hint": "bg:#20212c #888888",
        }
    )


def bottom_toolbar(mode: str, model: str, provider: str) -> FormattedText:
    folder = Path.cwd().name or str(Path.cwd())
    mode_name = "Auto" if mode == "auto" else "Manual"
    return FormattedText(
        [
            ("class:toolbar-location", f"→ {folder} · {model} ({provider})"),
            ("", "\n"),
            ("class:toolbar-mode", f"{mode_name} mode"),
            ("class:toolbar-hint", " (tab to cycle)"),
        ]
    )


class SlashCommandCompleter(Completer):
    """Offer slash commands as soon as the user types a slash."""

    def get_completions(self, document: Document, complete_event):
        before_cursor = document.text_before_cursor
        if " " in before_cursor:
            return

        partial = before_cursor
        if not partial.startswith("/"):
            return

        for command, description in COMMANDS:
            shown_command = command.rstrip()
            if shown_command.startswith(partial):
                yield Completion(
                    command,
                    start_position=-len(partial),
                    display=(
                        f"{shown_command} <dir>"
                        if command == "/files "
                        else shown_command
                    ),
                    display_meta=description,
                )


def _print_header(console: Console, model: str, provider: str) -> None:
    console.print(make_logo())
    identity = Text(">_ CAMIN Agent (v0.1.0)", style="bold magenta")
    identity.append(
        f"\nAPI Key | {model} ({provider}) (/model to change)",
        style="dim",
    )
    console.print(Panel(identity, border_style="white", expand=False, padding=(0, 1)))
    console.print(
        "Tips: Type / to open the command popup; Tab autocompletes slash commands.",
        style="dim",
    )


def _show_files(console: Console, directory: str) -> None:
    from core.file_editor import list_files

    files = list_files(directory)
    table = Table(title=f"Files under {directory}", show_header=False, expand=False)
    table.add_column("Path")
    for file_path in files:
        table.add_row(file_path)
    if files:
        console.print(table)
    else:
        console.print(f"No files found under {directory}.", style="dim")


def _run_once(goal: str, run_loop, console: Console) -> int:
    console.print(Text(f"Goal: {goal}", style="bold magenta"))
    try:
        with console.status("[bold #4facfe]CAMIN is working…[/bold #4facfe]", spinner="dots"):
            run_loop(goal)
    except Exception as exc:
        console.print(Text(f"Agent run failed: {exc}", style="bold red"))
        return 1
    console.print("Agent run finished.", style="green")
    return 0


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="camin",
        description="Run the CAMIN engineering agent.",
    )
    parser.add_argument(
        "goal",
        nargs="?",
        help="Run the agent once with this goal, then exit.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Run the saved goal from memory.json, then exit.",
    )
    args = parser.parse_args()
    if args.resume and args.goal is not None:
        parser.error("provide a goal or --resume, not both")

    model, provider = configure_agent_environment()

    from agent_loop import run_loop
    from core import memory

    console = Console()
    if args.goal is not None:
        return _run_once(args.goal, run_loop, console)

    if args.resume:
        try:
            goal = memory.load()["goal"]
        except Exception as exc:
            console.print(Text(f"Could not load saved goal: {exc}", style="bold red"))
            return 1
        if not goal:
            console.print("No saved goal was found in memory.json.", style="yellow")
            return 1
        return _run_once(goal, run_loop, console)

    style = make_style()
    mode = {"value": "auto"}
    key_bindings = KeyBindings()

    @key_bindings.add("tab")
    def _handle_tab(event) -> None:
        buffer = event.current_buffer
        if not buffer.text:
            mode["value"] = "manual" if mode["value"] == "auto" else "auto"
            event.app.invalidate()
            return
        if buffer.text.startswith("/"):
            if buffer.complete_state:
                buffer.complete_next()
            else:
                buffer.start_completion(select_first=True)
            return
        buffer.insert_text("\t")

    session: PromptSession[str] = PromptSession(
        completer=SlashCommandCompleter(),
        complete_while_typing=True,
        key_bindings=key_bindings,
        style=style,
        bottom_toolbar=lambda: bottom_toolbar(mode["value"], model, provider),
    )
    confirmation_session: PromptSession[str] = PromptSession(style=style)
    model_session: PromptSession[str] = PromptSession(style=style)

    def run_goal(goal: str) -> None:
        if not has_llm_configuration():
            console.print(
                "No LLM credentials or endpoint are configured. Set LLM_API_KEY "
                "or OPENAI_API_KEY in your environment or local .env file.",
                style="bold yellow",
            )
            return

        if mode["value"] == "manual":
            confirmation = confirmation_session.prompt(
                FormattedText(
                    [
                        ("class:confirm", "Run agent on: "),
                        ("", goal),
                        ("class:confirm", " (y/N) "),
                    ]
                )
            )
            if confirmation.strip().lower() not in {"y", "yes"}:
                console.print("Run cancelled.", style="yellow")
                return

        _run_once(goal, run_loop, console)

    def change_model() -> str:
        nonlocal model
        console.print(f"Current model: {model}", style="dim")
        new_model = model_session.prompt(
            HTML("<ansibrightblue>New model (blank to cancel): </ansibrightblue>")
        ).strip()
        if new_model:
            model = new_model
            os.environ["OPENAI_MODEL"] = model
            os.environ["LLM_MODEL"] = model
            console.print(f"Model changed to {model}.", style="green")
        else:
            console.print("Model unchanged.", style="dim")
        return model

    def handle_command(raw_input: str) -> bool:
        nonlocal model
        try:
            parts = shlex.split(raw_input)
        except ValueError as exc:
            console.print(Text(f"Could not parse command: {exc}", style="bold red"))
            return False

        command = parts[0].lower()
        arguments = parts[1:]

        if command == "/exit":
            return True
        if command == "/help":
            help_table = Table(title="CAMIN commands", show_header=True, expand=False)
            help_table.add_column("Command", style="cyan")
            help_table.add_column("Description")
            help_table.add_row("/help", "Show this command list")
            help_table.add_row("/resume", "Resume the goal saved in memory.json")
            help_table.add_row("/files <dir>", "List files under a project directory")
            help_table.add_row("/model", "Change the active model for future runs")
            help_table.add_row("/clear", "Clear and redraw the terminal")
            help_table.add_row("/exit", "Exit CAMIN")
            console.print(help_table)
            return False
        if command == "/clear":
            console.clear()
            _print_header(console, model, provider)
            return False
        if command == "/files":
            directory = " ".join(arguments) if arguments else "."
            try:
                _show_files(console, directory)
            except Exception as exc:
                console.print(Text(f"Could not list files: {exc}", style="bold red"))
            return False
        if command == "/resume":
            try:
                goal = memory.load()["goal"]
            except Exception as exc:
                console.print(Text(f"Could not load saved goal: {exc}", style="bold red"))
                return False
            if not goal:
                console.print("No saved goal was found in memory.json.", style="yellow")
            else:
                console.print(f"Resuming saved goal: {goal}", style="magenta")
                run_goal(goal)
            return False
        if command == "/model":
            if arguments:
                model = " ".join(arguments)
                os.environ["OPENAI_MODEL"] = model
                os.environ["LLM_MODEL"] = model
                console.print(f"Model changed to {model}.", style="green")
            else:
                change_model()
            return False

        console.print(
            Text(f"Unknown command: {command}. Type /help to see commands.", style="yellow")
        )
        return False

    _print_header(console, model, provider)

    try:
        while True:
            console.print(Rule(style="#4facfe", characters="─"))
            user_input = session.prompt(
                HTML("<ansibrightblue><b>&gt; </b></ansibrightblue>"),
                placeholder=HTML(
                    "<style fg='#888888'>Type your message or /command</style>"
                ),
            ).strip()
            console.print(Rule(style="#4facfe", characters="─"))

            if not user_input:
                continue
            if user_input.startswith("/"):
                if handle_command(user_input):
                    break
                continue

            run_goal(user_input)
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        console.print("\nGoodbye.", style="dim")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
