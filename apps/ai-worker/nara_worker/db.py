"""Database connection pool management.

Provides a singleton async connection pool to Postgres via psycopg3.
Used by jobs and async functions to obtain connections.
"""

from __future__ import annotations

from typing import Optional, Any

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import get_settings

# Singleton pool, lazily initialized
_pool: Optional[AsyncConnectionPool] = None


async def get_pool() -> AsyncConnectionPool:
    """Get the module-level async connection pool.

    Lazily initializes on first call. Returns the same pool on subsequent calls.

    Returns:
        An AsyncConnectionPool ready for connection() context managers.
        All connections use dict_row so rows are accessed as dicts.

    Example:
        pool = await get_pool()
        async with pool.connection() as conn:
            row = await fetchone(conn, "SELECT ...")
    """
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = AsyncConnectionPool(
            settings.database_url,
            min_size=2,
            max_size=10,
            open=False,
            kwargs={"row_factory": dict_row},
        )
        await _pool.open()
    return _pool


async def fetchone(conn, query: str, params: tuple = ()) -> Optional[dict]:
    """Execute a query and return a single row as a dict, or None."""
    cur = await conn.execute(query, params)
    return await cur.fetchone()


async def fetchall(conn, query: str, params: tuple = ()) -> list[dict]:
    """Execute a query and return all rows as a list of dicts."""
    cur = await conn.execute(query, params)
    return await cur.fetchall()


async def close_pool() -> None:
    """Close the module-level connection pool.

    Safe to call even if the pool was never initialized.
    """
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
