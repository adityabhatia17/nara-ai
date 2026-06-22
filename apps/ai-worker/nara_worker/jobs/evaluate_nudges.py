from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from ..db import get_pool, fetchone, fetchall

logger = logging.getLogger(__name__)
MAX_NUDGES_PER_DAY = 2
COOLDOWN_HOURS = 48
INACTIVITY_DAYS = 4


async def _in_quiet_hours(conn, user_id: str) -> bool:
    pref = await fetchone(
        conn,
        "SELECT quiet_hours_start, quiet_hours_end, timezone "
        "FROM notification_preferences WHERE user_id = %s",
        (user_id,),
    )
    if not pref:
        return False
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(pref["timezone"] or "UTC")
    local_hour = datetime.now(tz).hour
    start, end = pref["quiet_hours_start"], pref["quiet_hours_end"]
    if start > end:  # crosses midnight
        return local_hour >= start or local_hour < end
    return start <= local_hour < end


async def _nudge_on_cooldown(conn, user_id: str, nudge_type: str) -> bool:
    row = await fetchone(
        conn,
        "SELECT created_at FROM nudges "
        "WHERE user_id = %s AND nudge_type = %s "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id, nudge_type),
    )
    if not row:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(hours=COOLDOWN_HOURS)
    return row["created_at"] > cutoff


async def evaluate_nudges_for_user(conn, user_id: str) -> None:
    if await _in_quiet_hours(conn, user_id):
        return

    today_count = await fetchone(
        conn,
        "SELECT COUNT(*) as c FROM nudges "
        "WHERE user_id = %s AND created_at > now() - interval '1 day'",
        (user_id,),
    )
    if today_count and today_count["c"] >= MAX_NUDGES_PER_DAY:
        return

    # Inactivity nudge
    if not await _nudge_on_cooldown(conn, user_id, "inactivity"):
        last = await fetchone(
            conn,
            "SELECT created_at FROM entries "
            "WHERE user_id = %s ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        )
        if last:
            days_ago = (datetime.now(timezone.utc) - last["created_at"]).days
            if days_ago >= INACTIVITY_DAYS:
                await conn.execute(
                    "INSERT INTO nudges (user_id, nudge_type, content) VALUES (%s, 'inactivity', %s)",
                    (user_id, f"You haven't added anything in {days_ago} days. What's on your mind?"),
                )
                return

    # Loose end nudge
    if not await _nudge_on_cooldown(conn, user_id, "loose_end"):
        le = await fetchone(
            conn,
            "SELECT le.id, le.intention_text, le.note_id FROM loose_ends le "
            "WHERE le.user_id = %s AND le.status = 'open' "
            "ORDER BY le.created_at ASC LIMIT 1",
            (user_id,),
        )
        if le:
            await conn.execute(
                "INSERT INTO nudges (user_id, nudge_type, content, source_note_id) "
                "VALUES (%s, 'loose_end', %s, %s)",
                (user_id, f"You mentioned: \"{le['intention_text']}\". Still thinking about it?", le["note_id"]),
            )


async def run_evaluate_nudges() -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        users = await fetchall(
            conn,
            "SELECT DISTINCT user_id FROM notification_preferences",
        )
        for user in users:
            await evaluate_nudges_for_user(conn, user["user_id"])
