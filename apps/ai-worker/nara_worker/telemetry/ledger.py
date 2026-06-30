"""The ai_events writer.

`record_event` opens its own short-lived connection from the pool so callers don't have
to thread one through. Every write is NON-FATAL: telemetry must never break a user
request, so any failure here is swallowed with a warning (Rule #14).
"""

from __future__ import annotations

import logging
from typing import Any

from ..db import get_pool

logger = logging.getLogger(__name__)


async def record_event(
    *,
    operation: str,
    model: str,
    user_id: str | None = None,
    prompt_version: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int | None = None,
    cost_usd: float = 0.0,
    success: bool = True,
    error: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    import json

    try:
        pool = await get_pool()
        async with pool.connection() as conn:
            await conn.execute(
                """
                INSERT INTO ai_events
                  (user_id, operation, model, prompt_version,
                   input_tokens, output_tokens, latency_ms, cost_usd,
                   success, error, meta)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    user_id, operation, model, prompt_version,
                    input_tokens, output_tokens, latency_ms, cost_usd,
                    success, error, json.dumps(meta or {}),
                ),
            )
    except Exception as exc:  # never let telemetry break the pipeline
        logger.warning("ai_events write failed (%s/%s): %s", operation, model, exc)
