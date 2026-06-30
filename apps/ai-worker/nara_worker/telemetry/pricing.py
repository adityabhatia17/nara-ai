"""Static model price map and cost computation.

Prices are USD per 1,000,000 tokens, taken from the providers' public pricing pages.
They change rarely; update the numbers here when a provider changes pricing. We compute
cost ourselves (rather than calling a paid service) so cost tracking stays $0 and fully
private — we only ever handle token counts, never message content.
"""

from __future__ import annotations

# USD per 1M tokens. output=0.0 for embedding models (no output tokens).
MODEL_PRICING: dict[str, dict[str, float]] = {
    "llama-3.1-8b-instant":    {"input": 0.05, "output": 0.08},
    "llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "text-embedding-3-small":  {"input": 0.02, "output": 0.0},
}

_PER_TOKEN = 1_000_000.0


def _normalize(model: str | None) -> str:
    """Strip any provider prefix, e.g. 'groq/llama-3.1-8b-instant' -> 'llama-3.1-8b-instant'."""
    if not model:
        return ""
    return model.split("/")[-1].strip()


def estimate_cost(model: str | None, input_tokens: int, output_tokens: int) -> float:
    """Return the USD cost for a call. Unknown models cost 0.0 (logged, not priced)."""
    price = MODEL_PRICING.get(_normalize(model))
    if not price:
        return 0.0
    return (input_tokens * price["input"] + output_tokens * price["output"]) / _PER_TOKEN
