from __future__ import annotations

import logging
import time

from ..telemetry import record_event
from ..telemetry.pricing import estimate_cost

logger = logging.getLogger(__name__)

# OpenAI's embeddings endpoint via LangChain's aembed_query returns only the vector,
# not token usage — so (unlike the chat chains, which the callback instruments
# automatically) we record the embedding event by hand and estimate tokens from text
# length (~4 chars/token). Cost is fractions of a cent, so the estimate is plenty.
_CHARS_PER_TOKEN = 4


async def embed_note(conn, note_id: str, user_id: str, content: str) -> bool:
    """Embed a note and store in note_embeddings.

    Returns True on success, False on failure.
    Failure is NON-FATAL (Rule #14): the note still appears; embedding is re-queued.
    """
    model = "text-embedding-3-small"
    est_tokens = max(1, len(content) // _CHARS_PER_TOKEN)
    started = time.monotonic()
    try:
        from ..clients.openai import get_embeddings
        embeddings = get_embeddings()
        vector = await embeddings.aembed_query(content)
        await conn.execute(
            """
            INSERT INTO note_embeddings (note_id, user_id, embedding)
            VALUES (%s, %s, %s::vector)
            ON CONFLICT (note_id)
            DO UPDATE SET embedding = EXCLUDED.embedding,
                          model = EXCLUDED.model
            """,
            (note_id, user_id, vector),
        )
        await record_event(
            operation="embedding",
            model=model,
            user_id=user_id,
            input_tokens=est_tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=estimate_cost(model, est_tokens, 0),
            success=True,
            meta={"estimated_tokens": True, "note_id": note_id},
        )
        return True
    except Exception as exc:
        logger.warning("Embedding failed for note %s -- will retry: %s", note_id, exc)
        await record_event(
            operation="embedding",
            model=model,
            user_id=user_id,
            input_tokens=est_tokens,
            latency_ms=int((time.monotonic() - started) * 1000),
            cost_usd=0.0,
            success=False,
            error=str(exc)[:500],
            meta={"estimated_tokens": True, "note_id": note_id},
        )
        return False
