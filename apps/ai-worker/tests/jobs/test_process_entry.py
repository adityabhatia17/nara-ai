"""Tests for the process_entry job.

These tests use mocking to avoid actual database connections and LLM calls.
Focus is on the orchestration logic and idempotency guarantees.

The job calls the module-level helper `fetchone(conn, sql, params)` imported from
..db, so tests patch `nara_worker.jobs.process_entry.fetchone` (not conn.fetchone).
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


def _make_conn():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    return conn


def _make_pool_for_conn(conn):
    pool = AsyncMock()
    pool.connection = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=conn),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    return pool


@pytest.mark.asyncio
async def test_process_entry_can_be_imported():
    """Smoke test: process_entry can be imported and is callable."""
    from nara_worker.jobs.process_entry import process_entry
    assert callable(process_entry)


@pytest.mark.asyncio
async def test_skips_entry_with_done_status():
    """Entry in 'done' status must be skipped (idempotency)."""
    entry_id = str(uuid4())
    mock_conn = _make_conn()
    mock_pool = _make_pool_for_conn(mock_conn)

    fetchone = AsyncMock(return_value={
        "id": entry_id, "user_id": str(uuid4()), "raw_text": "test", "status": "done",
    })

    from nara_worker.jobs.process_entry import process_entry as _process_entry
    with patch("nara_worker.jobs.process_entry.get_pool", return_value=mock_pool), \
         patch("nara_worker.jobs.process_entry.fetchone", fetchone):
        await _process_entry(entry_id)

    fetchone.assert_called_once()
    # Should not mark as processing since status is already 'done'
    processing = [c for c in mock_conn.execute.call_args_list
                  if "status='processing'" in c[0][0]]
    assert len(processing) == 0


@pytest.mark.asyncio
async def test_skips_entry_missing():
    """Entry that doesn't exist must be skipped gracefully."""
    entry_id = str(uuid4())
    mock_conn = _make_conn()
    mock_pool = _make_pool_for_conn(mock_conn)

    fetchone = AsyncMock(return_value=None)  # Not found

    from nara_worker.jobs.process_entry import process_entry as _process_entry
    with patch("nara_worker.jobs.process_entry.get_pool", return_value=mock_pool), \
         patch("nara_worker.jobs.process_entry.fetchone", fetchone):
        await _process_entry(entry_id)

    fetchone.assert_called_once()
    mock_conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_marks_failed_on_extraction_error():
    """If extraction raises, entry must be marked failed with error message."""
    entry_id = str(uuid4())
    user_id = str(uuid4())
    entry_row = {
        "id": entry_id, "user_id": user_id, "raw_text": "some text", "status": "pending",
    }

    conn1 = _make_conn()
    conn2 = _make_conn()
    pools = [_make_pool_for_conn(conn1), _make_pool_for_conn(conn2)]
    call_count = [0]

    def get_pool_side_effect():
        idx = call_count[0]
        call_count[0] += 1
        return pools[min(idx, len(pools) - 1)]

    fetchone = AsyncMock(return_value=entry_row)

    with patch("nara_worker.jobs.process_entry.get_pool", side_effect=get_pool_side_effect), \
         patch("nara_worker.jobs.process_entry.fetchone", fetchone), \
         patch("nara_worker.jobs.process_entry.extract_from_text", side_effect=Exception("LLM timeout")):
        from nara_worker.jobs.process_entry import process_entry
        await process_entry(entry_id)

    failed_calls = [
        c for c in conn2.execute.call_args_list
        if "UPDATE entries SET status='failed'" in c[0][0]
    ]
    assert len(failed_calls) >= 1
    assert "LLM timeout" in str(failed_calls[0])


@pytest.mark.asyncio
async def test_marks_processing_then_done_on_success():
    """Successful extraction → persistence → marks entry as 'done'."""
    entry_id = str(uuid4())
    user_id = str(uuid4())
    entry_row = {
        "id": entry_id, "user_id": user_id, "raw_text": "Had a nice day.", "status": "pending",
    }

    mock_note = MagicMock()
    mock_note.content = "Had a nice day."
    mock_note.emotion_score = 0.5
    mock_note.categories = []
    mock_note.entities = []
    mock_note.intentions = []
    mock_extraction = MagicMock()
    mock_extraction.notes = [mock_note]

    conn1, conn2, conn3 = _make_conn(), _make_conn(), _make_conn()
    pools = [_make_pool_for_conn(conn1), _make_pool_for_conn(conn2), _make_pool_for_conn(conn3)]
    call_count = [0]

    def get_pool_side_effect():
        idx = call_count[0]
        call_count[0] += 1
        return pools[min(idx, len(pools) - 1)]

    fetchone = AsyncMock(return_value=entry_row)

    with patch("nara_worker.jobs.process_entry.get_pool", side_effect=get_pool_side_effect), \
         patch("nara_worker.jobs.process_entry.fetchone", fetchone), \
         patch("nara_worker.jobs.process_entry.extract_from_text", return_value=mock_extraction), \
         patch("nara_worker.jobs.process_entry.save_notes_from_extraction", return_value=[str(uuid4())]), \
         patch("nara_worker.jobs.process_entry.embed_note", return_value=True):
        from nara_worker.jobs.process_entry import process_entry
        await process_entry(entry_id)

    done_calls = [
        c for c in conn2.execute.call_args_list
        if "UPDATE entries SET status='done'" in c[0][0]
    ]
    assert len(done_calls) >= 1
