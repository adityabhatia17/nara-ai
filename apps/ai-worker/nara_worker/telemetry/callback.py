"""LangChain callback that turns every LLM call into an ai_events row.

How it works: LangChain fires lifecycle hooks on every model call. We record the start
time on `on_(chat_model|llm)_start`, then on `on_llm_end` we read the standardized token
usage off the response, compute cost from the static price map, and write one row. The
chain logic never changes — we only attach this handler (and a little metadata) via the
call's `config`.

Operation / user_id / prompt_version are not visible to a model call by themselves, so
the caller passes them as `metadata`, which LangChain forwards to the callback.
"""

from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult

from .ledger import record_event
from .pricing import estimate_cost


def _extract_usage(response: LLMResult) -> tuple[int, int, str]:
    """Return (input_tokens, output_tokens, model) defensively across providers."""
    # Preferred: the standardized usage_metadata on the chat message (langchain-core >=0.3)
    try:
        gen = response.generations[0][0]
        message = getattr(gen, "message", None)
        if message is not None:
            um = getattr(message, "usage_metadata", None) or {}
            meta = getattr(message, "response_metadata", None) or {}
            model = meta.get("model_name") or (response.llm_output or {}).get("model_name") or ""
            if um:
                return int(um.get("input_tokens", 0)), int(um.get("output_tokens", 0)), model
    except Exception:
        pass
    # Fallback: provider token_usage in llm_output
    lo = response.llm_output or {}
    tu = lo.get("token_usage") or lo.get("usage") or {}
    return (
        int(tu.get("prompt_tokens", 0)),
        int(tu.get("completion_tokens", 0)),
        lo.get("model_name", ""),
    )


class AiCostCallback(AsyncCallbackHandler):
    """Records cost + latency for each LLM call into ai_events."""

    def __init__(self) -> None:
        # run_id -> (start_monotonic, metadata)
        self._starts: dict[UUID, tuple[float, dict[str, Any]]] = {}

    async def on_chat_model_start(self, serialized, messages, *, run_id, metadata=None, **kwargs):
        self._starts[run_id] = (time.monotonic(), metadata or {})

    async def on_llm_start(self, serialized, prompts, *, run_id, metadata=None, **kwargs):
        self._starts[run_id] = (time.monotonic(), metadata or {})

    async def on_llm_end(self, response: LLMResult, *, run_id, **kwargs):
        start, meta = self._starts.pop(run_id, (None, {}))
        latency_ms = int((time.monotonic() - start) * 1000) if start is not None else None
        in_tok, out_tok, model = _extract_usage(response)
        await record_event(
            operation=meta.get("operation", "llm"),
            user_id=meta.get("user_id"),
            prompt_version=meta.get("prompt_version"),
            model=model,
            input_tokens=in_tok,
            output_tokens=out_tok,
            latency_ms=latency_ms,
            cost_usd=estimate_cost(model, in_tok, out_tok),
            success=True,
        )

    async def on_llm_error(self, error, *, run_id, **kwargs):
        start, meta = self._starts.pop(run_id, (None, {}))
        latency_ms = int((time.monotonic() - start) * 1000) if start is not None else None
        await record_event(
            operation=meta.get("operation", "llm"),
            user_id=meta.get("user_id"),
            prompt_version=meta.get("prompt_version"),
            model="",
            latency_ms=latency_ms,
            success=False,
            error=str(error)[:500],
        )


# One shared handler instance for the whole worker.
cost_callback = AiCostCallback()


def telemetry_config(operation: str, user_id: str | None = None,
                     prompt_version: str | None = None) -> dict[str, Any]:
    """Build the LangChain `config` that attaches the cost callback + metadata.

    Usage:  await chain.ainvoke(inputs, config=telemetry_config("ask", user_id))
    """
    return {
        "callbacks": [cost_callback],
        "metadata": {
            "operation": operation,
            "user_id": str(user_id) if user_id else None,
            "prompt_version": prompt_version,
        },
    }
