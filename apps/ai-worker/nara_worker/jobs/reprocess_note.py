"""Re-process an existing note after edit/append: re-embed + additively link new entities.

Re-embedding is the critical fix -- it keeps Ask Nara (RAG) retrieval consistent with
the note's current text. Entity handling is ADDITIVE only: newly-mentioned entities are
linked, but existing links and mention_count/co-occurrence aggregates are left intact to
avoid corrupting the append-only entity graph (Risk #1). Full entity reconciliation on
edit (removal/decrement) is a deferred, larger design change.
"""

from __future__ import annotations

import logging

from ..db import get_pool, fetchone, fetchall
from ..pipeline.embedding import embed_note
from ..pipeline.extraction import extract_from_text
from ..pipeline.persistence import find_or_create_entity

logger = logging.getLogger(__name__)


async def reprocess_note(note_id: str) -> None:
    """Re-embed a note and additively link any newly-mentioned entities.

    Idempotent and safe to retry. Embedding failure is non-fatal.
    """
    pool = await get_pool()

    async with pool.connection() as conn:
        note = await fetchone(
            conn,
            "SELECT id, user_id, content FROM notes WHERE id = %s",
            (note_id,),
        )
    if not note:
        logger.info("reprocess_note: note %s not found -- skipping", note_id)
        return

    user_id = note["user_id"]
    content = note["content"]

    # 1. Re-embed (CRITICAL -- fixes RAG staleness). Non-fatal.
    pool2 = await get_pool()
    async with pool2.connection() as conn:
        ok = await embed_note(conn=conn, note_id=note_id, user_id=user_id, content=content)
        if not ok:
            logger.warning("reprocess_note: re-embed failed for note %s (will not block)", note_id)

    # 2. Additively link newly-mentioned entities (no double-counting).
    try:
        extraction = await extract_from_text(content, user_id=user_id)
    except Exception as exc:
        logger.warning("reprocess_note: extraction failed for note %s: %s", note_id, exc)
        return

    # Collect distinct (name, type, snippet) from the re-extraction
    new_entities: dict[tuple[str, str], tuple[str, str | None]] = {}
    for n in extraction.notes:
        for e in n.entities:
            key = (e.type, e.name.lower())
            if key not in new_entities:
                new_entities[key] = (e.name, e.context_snippet)

    pool3 = await get_pool()
    async with pool3.connection() as conn:
        # entity (type, lower(name)) pairs already linked to THIS note
        existing = await fetchall(
            conn,
            "SELECT e.entity_type AS etype, lower(e.name) AS lname "
            "FROM note_entities ne JOIN entities e ON e.id = ne.entity_id "
            "WHERE ne.note_id = %s",
            (note_id,),
        )
        existing_keys = {(r["etype"], r["lname"]) for r in existing}

        linked = 0
        async with conn.transaction():
            for (etype, lname), (orig_name, snippet) in new_entities.items():
                if (etype, lname) in existing_keys:
                    continue  # already linked -- skip to avoid mention_count inflation
                eid = await find_or_create_entity(conn, user_id, orig_name, etype)
                await conn.execute(
                    "INSERT INTO note_entities (note_id, entity_id, context_snippet) "
                    "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    (note_id, eid, snippet),
                )
                linked += 1

    logger.info("reprocess_note: note %s re-embedded; %d new entit(ies) linked", note_id, linked)
