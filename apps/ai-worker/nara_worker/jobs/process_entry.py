"""Process a single entry through the full pipeline: extraction → persistence → embedding.

Orchestrates the three stages of the AI pipeline:
1. Extract structured notes from raw text via LLM
2. Persist notes, entities, categories, and loose-ends to the database
3. Embed each note (non-fatal — failures don't block pipeline completion)

Idempotent: only processes entries in 'pending' or 'failed' status.
"""

from __future__ import annotations

import logging

from ..db import get_pool, fetchone
from ..pipeline.extraction import extract_from_text
from ..pipeline.persistence import save_notes_from_extraction
from ..pipeline.embedding import embed_note

logger = logging.getLogger(__name__)


async def process_entry(entry_id: str) -> None:
    """Orchestrate extraction → persistence → embedding for one entry.

    Idempotent: skips entries that aren't in 'pending' or 'failed' state.
    Embedding failures are non-fatal (Rule #14).

    Args:
        entry_id: The UUID of the entry to process.

    Returns:
        None. Status is updated in the database.

    Raises:
        No exceptions: failures are logged and entry marked as 'failed'.
    """
    pool = await get_pool()

    # Fetch entry and check status (idempotency guard)
    async with pool.connection() as conn:
        row = await fetchone(
            conn,
            "SELECT id, user_id, raw_text, status FROM entries WHERE id = %s",
            (entry_id,),
        )
        if not row or row["status"] not in ("pending", "failed"):
            logger.info(
                "Skipping entry %s (status=%s)",
                entry_id,
                row["status"] if row else "missing",
            )
            return

        # Mark as processing
        async with conn.transaction():
            await conn.execute(
                "UPDATE entries SET status='processing' WHERE id = %s",
                (entry_id,),
            )

    # Extraction is slow — keep it outside any transaction
    # Get a fresh connection to avoid blocking the pool
    pool2 = await get_pool()
    async with pool2.connection() as conn:
        try:
            extraction = await extract_from_text(row["raw_text"], user_id=row["user_id"])
        except Exception as exc:
            logger.error("Extraction failed for entry %s: %s", entry_id, exc)
            async with conn.transaction():
                await conn.execute(
                    "UPDATE entries SET status='failed', error=%s WHERE id = %s",
                    (str(exc), entry_id),
                )
            return

        # Persist notes, entities, categories, co-occurrences in a transaction
        async with conn.transaction():
            note_ids = await save_notes_from_extraction(
                conn=conn,
                user_id=row["user_id"],
                entry_id=entry_id,
                extraction=extraction,
            )
            await conn.execute(
                "UPDATE entries SET status='done', processed_at=now() WHERE id = %s",
                (entry_id,),
            )

    # Embed each note — non-fatal, outside transaction
    # Get a fresh connection for embedding
    pool3 = await get_pool()
    async with pool3.connection() as conn:
        for note_id, extracted in zip(note_ids, extraction.notes):
            await embed_note(
                conn=conn,
                note_id=note_id,
                user_id=row["user_id"],
                content=extracted.content,
            )

    logger.info("Entry %s processed → %d notes", entry_id, len(note_ids))
