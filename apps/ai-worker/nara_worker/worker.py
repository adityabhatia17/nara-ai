from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

import psycopg
from fastapi import FastAPI
from pydantic import BaseModel

from .config import get_settings
from .db import close_pool, get_pool
from .jobs.process_entry import process_entry
from .jobs.detect_patterns import run_detect_patterns
from .jobs.weekly_letter import run_weekly_letters
from .jobs.evaluate_nudges import run_evaluate_nudges
from .jobs.sweeper import requeue_stuck_entries
from .rag.ask_nara import ask_nara as _ask_nara

logger = logging.getLogger(__name__)


async def _poll_jobs() -> None:
    """Poll pgboss.job for pending process_entry jobs and run them."""
    s = get_settings()
    interval = s.worker_poll_interval_ms / 1000
    conn_str = s.database_url
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(conn_str) as conn:
                cur = await conn.execute(
                    """
                    UPDATE pgboss.job
                    SET state = 'active', started_on = now()
                    WHERE id = (
                        SELECT id FROM pgboss.job
                        WHERE name = 'process_entry' AND state = 'created'
                        ORDER BY created_on ASC
                        LIMIT 1
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING data
                    """
                )
                row = await cur.fetchone()
                if row:
                    payload = row[0]
                    entry_id = payload["entry_id"]
                    try:
                        await process_entry(entry_id)
                        await conn.execute(
                            "UPDATE pgboss.job SET state='completed', completed_on=now() "
                            "WHERE name='process_entry' AND data->>'entry_id' = %s AND state='active'",
                            (entry_id,),
                        )
                    except Exception as exc:
                        logger.error("Job failed for entry %s: %s", entry_id, exc)
                        await conn.execute(
                            "UPDATE pgboss.job SET state='failed' "
                            "WHERE name='process_entry' AND data->>'entry_id' = %s AND state='active'",
                            (entry_id,),
                        )
        except Exception as exc:
            logger.warning("Poll cycle error: %s", exc)
        await asyncio.sleep(interval)


async def _run_scheduled_jobs() -> None:
    """Simple clock-based scheduler — runs intelligence jobs on fixed schedules."""
    while True:
        now = datetime.utcnow()
        if now.hour == 2 and now.minute < 1:
            await run_detect_patterns()
        if now.weekday() == 6 and now.hour == 18 and now.minute < 1:
            await run_weekly_letters()
        if now.hour in (9, 19) and now.minute < 1:
            await run_evaluate_nudges()
        if now.minute % 5 == 0:
            await requeue_stuck_entries()
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(_poll_jobs())
    asyncio.create_task(_run_scheduled_jobs())
    yield
    await close_pool()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


class AskRequest(BaseModel):
    user_id: str
    question: str


@app.post("/ask")
async def ask_endpoint(req: AskRequest):
    return await _ask_nara(user_id=req.user_id, question=req.question)
