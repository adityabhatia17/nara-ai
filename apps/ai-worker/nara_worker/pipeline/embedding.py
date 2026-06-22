from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def embed_note(conn, note_id: str, user_id: str, content: str) -> bool:
    """Embed a note and store in note_embeddings.

    Returns True on success, False on failure.
    Failure is NON-FATAL (Rule #14): the note still appears; embedding is re-queued.
    """
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
        return True
    except Exception as exc:
        logger.warning("Embedding failed for note %s — will retry: %s", note_id, exc)
        return False
