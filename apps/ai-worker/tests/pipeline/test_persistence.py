import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from nara_worker.pipeline.persistence import (
    canonical_pair,
    find_or_create_category,
    find_or_create_entity,
    upsert_cooccurrence,
    save_notes_from_extraction,
)
from nara_worker.models import ExtractionResult, ExtractedNote


def test_canonical_pair_always_smaller_first():
    a, b = str(uuid4()), str(uuid4())
    r1 = canonical_pair(a, b)
    r2 = canonical_pair(b, a)
    assert r1 == r2
    assert r1[0] < r1[1]


def test_canonical_pair_raises_on_equal():
    uid = str(uuid4())
    with pytest.raises(ValueError):
        canonical_pair(uid, uid)


@pytest.mark.asyncio
async def test_save_notes_returns_note_ids():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchone = AsyncMock(return_value={"id": str(uuid4())})

    extraction = ExtractionResult(notes=[
        ExtractedNote(
            content="Test note",
            categories=["Work"],
            emotion_score=-0.5,
            entities=[],
            intentions=[],
        )
    ])

    with patch(
        "nara_worker.pipeline.persistence.find_or_create_category",
        new_callable=AsyncMock,
        return_value=str(uuid4()),
    ):
        note_ids = await save_notes_from_extraction(
            conn=conn,
            user_id=str(uuid4()),
            entry_id=str(uuid4()),
            extraction=extraction,
        )

    assert len(note_ids) == 1
    assert all(isinstance(nid, str) for nid in note_ids)


@pytest.mark.asyncio
async def test_loose_ends_written_for_intentions():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchone = AsyncMock(return_value={"id": str(uuid4())})

    extraction = ExtractionResult(notes=[
        ExtractedNote(
            content="I need to call Rohan back.",
            categories=["People"],
            emotion_score=None,
            entities=[],
            intentions=["Call Rohan back"],
        )
    ])

    with patch(
        "nara_worker.pipeline.persistence.find_or_create_category",
        new_callable=AsyncMock,
        return_value=str(uuid4()),
    ):
        await save_notes_from_extraction(
            conn=conn,
            user_id=str(uuid4()),
            entry_id=str(uuid4()),
            extraction=extraction,
        )

    all_sqls = [call[0][0] for call in conn.execute.call_args_list]
    assert any("loose_ends" in sql for sql in all_sqls)
