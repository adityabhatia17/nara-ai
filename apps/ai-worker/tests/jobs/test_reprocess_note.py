"""Tests for the reprocess_note job.

These tests use mocking to avoid actual database connections and LLM calls.
Focus is on early-exit when note is missing and correct embedding call when note exists.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from nara_worker.models import ExtractionResult


@pytest.mark.asyncio
async def test_reprocess_note_can_be_imported():
    """Smoke test: reprocess_note can be imported and is callable."""
    from nara_worker.jobs.reprocess_note import reprocess_note
    assert callable(reprocess_note)


def _make_mock_pool(mock_conn):
    """Build an AsyncMock pool whose .connection() context manager yields mock_conn."""
    mock_pool = AsyncMock()
    mock_pool.connection = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_conn),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    return mock_pool


@pytest.mark.asyncio
async def test_skips_when_note_not_found():
    """reprocess_note returns early (no error) when the note doesn't exist."""
    note_id = str(uuid4())

    mock_conn = AsyncMock()
    mock_pool = _make_mock_pool(mock_conn)

    mock_fetchone = AsyncMock(return_value=None)

    with (
        patch("nara_worker.jobs.reprocess_note.get_pool", return_value=mock_pool),
        patch("nara_worker.jobs.reprocess_note.fetchone", mock_fetchone),
        patch("nara_worker.jobs.reprocess_note.embed_note") as mock_embed,
    ):
        from nara_worker.jobs.reprocess_note import reprocess_note
        await reprocess_note(note_id)

    # fetchone was called to look up the note
    mock_fetchone.assert_called_once()
    # embed_note should NOT have been called since note was not found
    mock_embed.assert_not_called()


@pytest.mark.asyncio
async def test_embeds_note_when_found():
    """When the note exists, embed_note is called with the note's content."""
    note_id = str(uuid4())
    user_id = str(uuid4())
    content = "Had coffee with Priya at the new cafe downtown"

    mock_conn = AsyncMock()
    mock_conn.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    mock_pool = _make_mock_pool(mock_conn)

    mock_fetchone = AsyncMock(
        return_value={"id": note_id, "user_id": user_id, "content": content}
    )
    mock_fetchall = AsyncMock(return_value=[])
    mock_embed = AsyncMock(return_value=True)
    mock_extract = AsyncMock(return_value=ExtractionResult(notes=[]))

    with (
        patch("nara_worker.jobs.reprocess_note.get_pool", return_value=mock_pool),
        patch("nara_worker.jobs.reprocess_note.fetchone", mock_fetchone),
        patch("nara_worker.jobs.reprocess_note.fetchall", mock_fetchall),
        patch("nara_worker.jobs.reprocess_note.embed_note", mock_embed),
        patch("nara_worker.jobs.reprocess_note.extract_from_text", mock_extract),
    ):
        from nara_worker.jobs.reprocess_note import reprocess_note
        await reprocess_note(note_id)

    # embed_note called with correct args
    mock_embed.assert_called_once_with(
        conn=mock_conn, note_id=note_id, user_id=user_id, content=content
    )


@pytest.mark.asyncio
async def test_does_not_relink_existing_entities():
    """Entities already linked to the note should not trigger find_or_create_entity."""
    note_id = str(uuid4())
    user_id = str(uuid4())
    content = "Met Priya again"

    mock_conn = AsyncMock()
    mock_conn.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    mock_pool = _make_mock_pool(mock_conn)

    mock_fetchone = AsyncMock(
        return_value={"id": note_id, "user_id": user_id, "content": content}
    )
    # Simulate "Priya" (person) already linked to this note
    mock_fetchall = AsyncMock(
        return_value=[{"etype": "person", "lname": "priya"}]
    )
    mock_embed = AsyncMock(return_value=True)

    # Extraction returns "Priya" as a person entity (already linked)
    from nara_worker.models import ExtractedNote, ExtractedEntity
    extraction = ExtractionResult(notes=[
        ExtractedNote(
            content=content,
            entities=[ExtractedEntity(name="Priya", type="person", context_snippet="Met Priya")],
        )
    ])
    mock_extract = AsyncMock(return_value=extraction)
    mock_find_or_create = AsyncMock(return_value=str(uuid4()))

    with (
        patch("nara_worker.jobs.reprocess_note.get_pool", return_value=mock_pool),
        patch("nara_worker.jobs.reprocess_note.fetchone", mock_fetchone),
        patch("nara_worker.jobs.reprocess_note.fetchall", mock_fetchall),
        patch("nara_worker.jobs.reprocess_note.embed_note", mock_embed),
        patch("nara_worker.jobs.reprocess_note.extract_from_text", mock_extract),
        patch("nara_worker.jobs.reprocess_note.find_or_create_entity", mock_find_or_create),
    ):
        from nara_worker.jobs.reprocess_note import reprocess_note
        await reprocess_note(note_id)

    # find_or_create_entity should NOT be called -- Priya is already linked
    mock_find_or_create.assert_not_called()
