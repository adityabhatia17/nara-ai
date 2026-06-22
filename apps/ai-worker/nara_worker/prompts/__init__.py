"""Versioned prompt modules — prompts are code (CLAUDE_BACKEND.md §10).

Each module exports:
  * ``SYSTEM_PROMPT`` — the system message.
  * ``VERSION`` — a string bumped whenever the prompt text changes.
  * a ``build_*`` function that constructs the user message from inputs.
"""
