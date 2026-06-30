from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4
from datetime import datetime, timezone

# The job calls the module-level helper `fetchone(conn, sql, params)` imported from
# ..db, so tests patch `nara_worker.jobs.evaluate_nudges.fetchone`. The patched mock
# receives (conn, sql, params) — note `conn` is the first positional arg.


@pytest.mark.asyncio
async def test_nudge_skipped_in_quiet_hours():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    user_id = str(uuid4())

    fetchone = AsyncMock(return_value={
        "quiet_hours_start": 0, "quiet_hours_end": 23, "timezone": "UTC"
    })

    from nara_worker.jobs.evaluate_nudges import evaluate_nudges_for_user
    with patch("nara_worker.jobs.evaluate_nudges.fetchone", fetchone):
        await evaluate_nudges_for_user(conn, user_id)

    insert_calls = [c for c in conn.execute.call_args_list if "INSERT INTO nudges" in c[0][0]]
    assert len(insert_calls) == 0


@pytest.mark.asyncio
async def test_inactivity_nudge_created():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    user_id = str(uuid4())

    old_time = datetime(2026, 6, 1, tzinfo=timezone.utc)

    def fetchone_side(_conn, sql, *args, **kwargs):
        if "notification_preferences" in sql:
            # quiet hours 10-14, so we're not in quiet hours at 3 AM
            return {"quiet_hours_start": 10, "quiet_hours_end": 14, "timezone": "UTC"}
        if "COUNT" in sql:
            return {"c": 0}
        if "nudges" in sql and "nudge_type" in sql:
            return None  # not on cooldown
        if "entries" in sql:
            return {"created_at": old_time}
        return None

    fetchone = AsyncMock(side_effect=fetchone_side)

    from nara_worker.jobs.evaluate_nudges import evaluate_nudges_for_user
    with patch("nara_worker.jobs.evaluate_nudges.fetchone", fetchone):
        await evaluate_nudges_for_user(conn, user_id)

    insert_calls = [c for c in conn.execute.call_args_list if "INSERT INTO nudges" in c[0][0]]
    assert len(insert_calls) >= 1
    assert "inactivity" in str(insert_calls[0])
