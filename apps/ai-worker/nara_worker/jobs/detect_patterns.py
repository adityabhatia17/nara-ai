from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

MIN_DATA_POINTS = 3  # Rule #3: no pattern surfaced below this threshold


async def detect_patterns_for_user(conn, user_id: str) -> int:
    """Detect co-occurrence patterns for one user. Returns number of patterns written."""
    rows = await conn.fetchall(
        """
        SELECT
            c.entity_a_id,
            c.entity_b_id,
            c.count,
            ea.name AS name_a,
            eb.name AS name_b
        FROM entity_cooccurrences c
        JOIN entities ea ON ea.id = c.entity_a_id
        JOIN entities eb ON eb.id = c.entity_b_id
        WHERE c.user_id = %s AND c.count >= %s
        ORDER BY c.count DESC
        """,
        (user_id, MIN_DATA_POINTS),
    )

    written = 0
    for row in rows:
        description = (
            f"{row['name_a']} and {row['name_b']} "
            f"appear together frequently ({row['count']} times)"
        )
        await conn.execute(
            """
            INSERT INTO patterns
                (user_id, pattern_type, description, entity_ids, data_points)
            VALUES (%s, 'cooccurrence', %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (
                user_id,
                description,
                [row["entity_a_id"], row["entity_b_id"]],
                row["count"],
            ),
        )
        written += 1

    if written:
        logger.info("Detected %d pattern(s) for user %s", written, user_id)
    return written


async def run_detect_patterns(conn) -> None:
    """Run pattern detection for all users who have entries."""
    users = await conn.fetchall(
        "SELECT DISTINCT user_id FROM entries WHERE status = 'done'"
    )
    for user in users:
        await detect_patterns_for_user(conn, user["user_id"])
