"""Database connection pool management.

Provides a singleton async connection pool to Postgres via psycopg3.
Used by jobs and async functions to obtain connections.
"""

from __future__ import annotations

from __future__ import annotations

from typing import Optional

from psycopg_pool import AsyncConnectionPool

from .config import get_settings

# Singleton pool, lazily initialized
_pool: Optional[AsyncConnectionPool] = None


async def get_pool() -> AsyncConnectionPool:
    """Get the module-level async connection pool.

    Lazily initializes on first call. Returns the same pool on subsequent calls.

    Returns:
        An AsyncConnectionPool ready for connection() context managers.

    Example:
        pool = await get_pool()
        async with pool.connection() as conn:
            row = await conn.fetchone("SELECT ...")
    """
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await AsyncConnectionPool.create(
            settings.database_url,
            min_size=2,
            max_size=10,
        )
    return _pool
