import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import date

# The job calls the module-level helper `fetchall(conn, sql, params)` imported from
# ..db, so tests patch `nara_worker.jobs.weekly_letter.fetchall`.


@pytest.mark.asyncio
async def test_letter_skipped_with_no_notes():
    conn = AsyncMock()
    conn.execute = AsyncMock()

    from nara_worker.jobs.weekly_letter import generate_letter_for_user
    with patch("nara_worker.jobs.weekly_letter.fetchall", AsyncMock(return_value=[])):
        await generate_letter_for_user(
            conn, str(uuid4()), date(2026, 6, 15), date(2026, 6, 21)
        )

    insert_calls = [
        c for c in conn.execute.call_args_list
        if "INSERT INTO weekly_letters" in c[0][0]
    ]
    assert len(insert_calls) == 0


@pytest.mark.asyncio
async def test_letter_written_with_enough_notes():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    rows = [
        {"content": "Had a stressful work deadline.", "created_at": "2026-06-16",
         "emotion_score": -0.6, "category_names": ["Work"]},
        {"content": "Went for a walk in the evening.", "created_at": "2026-06-17",
         "emotion_score": 0.4, "category_names": ["Health"]},
        {"content": "Talked to Rohan about the project.", "created_at": "2026-06-18",
         "emotion_score": 0.1, "category_names": ["Work"]},
    ]

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(
        return_value=MagicMock(content="This week you carried a lot.")
    )

    from nara_worker.jobs.weekly_letter import generate_letter_for_user
    with patch("nara_worker.jobs.weekly_letter.fetchall", AsyncMock(return_value=rows)), \
         patch("nara_worker.jobs.weekly_letter._get_quality_llm", return_value=mock_llm):
        await generate_letter_for_user(
            conn, str(uuid4()), date(2026, 6, 15), date(2026, 6, 21)
        )

    insert_calls = [
        c for c in conn.execute.call_args_list
        if "INSERT INTO weekly_letters" in c[0][0]
    ]
    assert len(insert_calls) == 1


@pytest.mark.asyncio
async def test_letter_skipped_below_min_notes():
    """Only 2 notes — below MIN_NOTES_FOR_LETTER=3, no letter written."""
    conn = AsyncMock()
    conn.execute = AsyncMock()
    rows = [
        {"content": "Note 1.", "created_at": "2026-06-16",
         "emotion_score": 0.0, "category_names": []},
        {"content": "Note 2.", "created_at": "2026-06-17",
         "emotion_score": 0.0, "category_names": []},
    ]

    from nara_worker.jobs.weekly_letter import generate_letter_for_user
    with patch("nara_worker.jobs.weekly_letter.fetchall", AsyncMock(return_value=rows)):
        await generate_letter_for_user(
            conn, str(uuid4()), date(2026, 6, 15), date(2026, 6, 21)
        )

    insert_calls = [
        c for c in conn.execute.call_args_list
        if "INSERT INTO weekly_letters" in c[0][0]
    ]
    assert len(insert_calls) == 0
