"""Tests for the process_entry job.

These tests use mocking to avoid actual database connections and LLM calls.
Focus is on the orchestration logic and idempotency guarantees.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


@pytest.mark.asyncio
async def test_process_entry_can_be_imported():
    """Smoke test: process_entry can be imported and is callable."""
    from nara_worker.jobs.process_entry import process_entry
    assert callable(process_entry)


@pytest.mark.asyncio
async def test_skips_entry_with_done_status():
    """Entry in 'done' status must be skipped (idempotency)."""
    entry_id = str(uuid4())

    # Mock connection that returns an entry with status='done'
    mock_conn = AsyncMock()
    mock_conn.fetchone = AsyncMock(
        return_value={
            "id": entry_id,
            "user_id": str(uuid4()),
            "raw_text": "test",
            "status": "done",
        }
    )
    mock_conn.execute = AsyncMock()
    mock_conn.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    # Mock pool
    mock_pool = AsyncMock()
    mock_pool.connection = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_conn),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    from nara_worker.jobs.process_entry import process_entry as _process_entry

    with patch("nara_worker.jobs.process_entry.get_pool", return_value=mock_pool):
        await _process_entry(entry_id)

    # Should only fetch, not process (no UPDATE to processing)
    mock_conn.fetchone.assert_called_once()


@pytest.mark.asyncio
async def test_skips_entry_missing():
    """Entry that doesn't exist must be skipped gracefully."""
    entry_id = str(uuid4())

    mock_conn = AsyncMock()
    mock_conn.fetchone = AsyncMock(return_value=None)  # Not found
    mock_conn.execute = AsyncMock()
    mock_conn.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    mock_pool = AsyncMock()
    mock_pool.connection = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_conn),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    from nara_worker.jobs.process_entry import process_entry as _process_entry

    with patch("nara_worker.jobs.process_entry.get_pool", return_value=mock_pool):
        await _process_entry(entry_id)

    # Should fetch once, then return early
    mock_conn.fetchone.assert_called_once()
    # execute should not be called for processing since entry doesn't exist
    mock_conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_marks_failed_on_extraction_error():
    """If extraction raises, entry must be marked failed with error message."""
    entry_id = str(uuid4())
    user_id = str(uuid4())

    entry_row = {
        "id": entry_id,
        "user_id": user_id,
        "raw_text": "some text",
        "status": "pending",
    }

    # Simulate two separate connections: one for status check, one for extraction attempt
    conn1 = AsyncMock()
    conn1.fetchone = AsyncMock(return_value=entry_row)
    conn1.execute = AsyncMock()
    conn1.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    conn2 = AsyncMock()
    conn2.execute = AsyncMock()
    conn2.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    # Track which connection is being returned
    call_count = [0]

    def make_pool_for_conn(conn):
        pool = AsyncMock()
        pool.connection = MagicMock(
            return_value=AsyncMock(
                __aenter__=AsyncMock(return_value=conn),
                __aexit__=AsyncMock(return_value=False),
            )
        )
        return pool

    pools = [make_pool_for_conn(conn1), make_pool_for_conn(conn2)]

    def get_pool_side_effect():
        idx = call_count[0]
        call_count[0] += 1
        return pools[min(idx, len(pools) - 1)]

    with patch("nara_worker.jobs.process_entry.get_pool", side_effect=get_pool_side_effect), \
         patch("nara_worker.jobs.process_entry.extract_from_text", side_effect=Exception("LLM timeout")):
        from nara_worker.jobs.process_entry import process_entry
        await process_entry(entry_id)

    # conn2 should have had status='failed' written
    failed_calls = [
        c for c in conn2.execute.call_args_list
        if "UPDATE entries SET status='failed'" in c[0][0]
    ]
    assert len(failed_calls) >= 1
    # Verify the error message was passed
    assert "LLM timeout" in str(failed_calls[0])


@pytest.mark.asyncio
async def test_marks_processing_then_done_on_success():
    """Successful extraction → persistence → marks entry as 'done'."""
    entry_id = str(uuid4())
    user_id = str(uuid4())

    entry_row = {
        "id": entry_id,
        "user_id": user_id,
        "raw_text": "Had a nice day.",
        "status": "pending",
    }

    # Mock extraction result
    mock_note = MagicMock()
    mock_note.content = "Had a nice day."
    mock_note.emotion_score = 0.5
    mock_note.categories = []
    mock_note.entities = []
    mock_note.intentions = []

    mock_extraction = MagicMock()
    mock_extraction.notes = [mock_note]

    conn1 = AsyncMock()
    conn1.fetchone = AsyncMock(return_value=entry_row)
    conn1.execute = AsyncMock()
    conn1.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    conn2 = AsyncMock()
    conn2.execute = AsyncMock()
    conn2.transaction = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=None),
            __aexit__=AsyncMock(return_value=False),
        )
    )

    conn3 = AsyncMock()
    conn3.execute = AsyncMock()

    call_count = [0]

    def make_pool_for_conn(conn):
        pool = AsyncMock()
        pool.connection = MagicMock(
            return_value=AsyncMock(
                __aenter__=AsyncMock(return_value=conn),
                __aexit__=AsyncMock(return_value=False),
            )
        )
        return pool

    pools = [
        make_pool_for_conn(conn1),
        make_pool_for_conn(conn2),
        make_pool_for_conn(conn3),
    ]

    def get_pool_side_effect():
        idx = call_count[0]
        call_count[0] += 1
        return pools[min(idx, len(pools) - 1)]

    with patch("nara_worker.jobs.process_entry.get_pool", side_effect=get_pool_side_effect), \
         patch("nara_worker.jobs.process_entry.extract_from_text", return_value=mock_extraction), \
         patch("nara_worker.jobs.process_entry.save_notes_from_extraction", return_value=[str(uuid4())]), \
         patch("nara_worker.jobs.process_entry.embed_note", return_value=True):
        from nara_worker.jobs.process_entry import process_entry
        await process_entry(entry_id)

    # conn2 should have status='done' written
    done_calls = [
        c for c in conn2.execute.call_args_list
        if "UPDATE entries SET status='done'" in c[0][0]
    ]
    assert len(done_calls) >= 1
