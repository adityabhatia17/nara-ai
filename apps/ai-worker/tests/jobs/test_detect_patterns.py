from __future__ import annotations

import pytest
from unittest.mock import AsyncMock
from uuid import uuid4


@pytest.mark.asyncio
async def test_no_pattern_below_threshold():
    """count=2 is below MIN_DATA_POINTS=3 — no INSERT INTO patterns."""
    conn = AsyncMock()
    conn.fetchall = AsyncMock(return_value=[])  # query filters count>=3, returns nothing
    conn.execute = AsyncMock()

    from nara_worker.jobs.detect_patterns import detect_patterns_for_user
    result = await detect_patterns_for_user(conn, str(uuid4()))

    assert result == 0
    conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_pattern_written_at_threshold():
    """count=4 >= MIN_DATA_POINTS=3 — exactly one INSERT."""
    eid_a, eid_b = str(uuid4()), str(uuid4())
    conn = AsyncMock()
    conn.fetchall = AsyncMock(return_value=[
        {
            "entity_a_id": eid_a,
            "entity_b_id": eid_b,
            "count": 4,
            "name_a": "Work",
            "name_b": "Stress",
        }
    ])
    conn.execute = AsyncMock()

    from nara_worker.jobs.detect_patterns import detect_patterns_for_user
    result = await detect_patterns_for_user(conn, str(uuid4()))

    assert result == 1
    conn.execute.assert_called_once()
    sql = conn.execute.call_args[0][0]
    assert "INSERT INTO patterns" in sql


@pytest.mark.asyncio
async def test_pattern_description_is_human_readable():
    """Verify description mentions both entity names."""
    eid_a, eid_b = str(uuid4()), str(uuid4())
    conn = AsyncMock()
    conn.fetchall = AsyncMock(return_value=[
        {
            "entity_a_id": eid_a,
            "entity_b_id": eid_b,
            "count": 5,
            "name_a": "Rohan",
            "name_b": "Stress",
        }
    ])
    conn.execute = AsyncMock()

    from nara_worker.jobs.detect_patterns import detect_patterns_for_user
    await detect_patterns_for_user(conn, str(uuid4()))

    call_args = conn.execute.call_args[0]
    description = call_args[1][1]  # second positional param is the description
    assert "Rohan" in description
    assert "Stress" in description


@pytest.mark.asyncio
async def test_multiple_patterns_multiple_inserts():
    conn = AsyncMock()
    conn.fetchall = AsyncMock(return_value=[
        {"entity_a_id": str(uuid4()), "entity_b_id": str(uuid4()),
         "count": 3, "name_a": "Work", "name_b": "Anxiety"},
        {"entity_a_id": str(uuid4()), "entity_b_id": str(uuid4()),
         "count": 7, "name_a": "Books", "name_b": "Calm"},
    ])
    conn.execute = AsyncMock()

    from nara_worker.jobs.detect_patterns import detect_patterns_for_user
    result = await detect_patterns_for_user(conn, str(uuid4()))

    assert result == 2
    assert conn.execute.call_count == 2
