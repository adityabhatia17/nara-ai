from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from ..db import get_pool

logger = logging.getLogger(__name__)


async def requeue_stuck_entries() -> None:
    """Reset entries stuck in 'processing' for >10 min back to 'pending'."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    pool = await get_pool()
    async with pool.connection() as conn:
        result = await conn.execute(
            "UPDATE entries SET status = 'pending' "
            "WHERE status = 'processing' AND created_at < %s",
            (cutoff,),
        )
        if result.rowcount:
            logger.info("Sweeper re-queued %d stuck entries", result.rowcount)
