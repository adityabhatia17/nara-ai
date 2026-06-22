from __future__ import annotations

import pytest
from unittest.mock import AsyncMock
from uuid import uuid4
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_nudge_skipped_in_quiet_hours():
    conn = AsyncMock()
    user_id = str(uuid4())
    conn.fetchone = AsyncMock(return_value={
        "quiet_hours_start": 0, "quiet_hours_end": 23, "timezone": "UTC"
    })

    from nara_worker.jobs.evaluate_nudges import evaluate_nudges_for_user
    await evaluate_nudges_for_user(conn, user_id)

    insert_calls = [c for c in conn.execute.call_args_list if "INSERT INTO nudges" in c[0][0]]
    assert len(insert_calls) == 0


@pytest.mark.asyncio
async def test_inactivity_nudge_created():
    conn = AsyncMock()
    user_id = str(uuid4())

    from datetime import timedelta
    old_time = datetime(2026, 6, 1, tzinfo=timezone.utc)

    def fetchone_side(sql, *args, **kwargs):
        if "notification_preferences" in sql:
            # quiet hours 10-14 (10 AM to 2 PM), so we're not in quiet hours at 3 AM
            return {"quiet_hours_start": 10, "quiet_hours_end": 14, "timezone": "UTC"}
        if "COUNT" in sql:
            return {"c": 0}
        if "nudges" in sql and "nudge_type" in sql:
            return None  # not on cooldown
        if "entries" in sql:
            return {"created_at": old_time}
        return None

    conn.fetchone = AsyncMock(side_effect=lambda sql, *a, **kw: fetchone_side(sql, *a, **kw))
    conn.execute = AsyncMock()

    from nara_worker.jobs.evaluate_nudges import evaluate_nudges_for_user
    await evaluate_nudges_for_user(conn, user_id)

    insert_calls = [c for c in conn.execute.call_args_list if "INSERT INTO nudges" in c[0][0]]
    assert len(insert_calls) >= 1
    assert "inactivity" in str(insert_calls[0])
