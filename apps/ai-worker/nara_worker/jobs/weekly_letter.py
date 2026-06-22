import logging
from datetime import date, timedelta
from langchain_core.prompts import ChatPromptTemplate
from ..clients.groq import get_quality_llm
from ..prompts.weekly_letter import WEEKLY_LETTER_SYSTEM_PROMPT
from ..db import fetchall

logger = logging.getLogger(__name__)
MIN_NOTES_FOR_LETTER = 3

# Lazy-initialized module-level variable, patchable for tests
quality_llm = None


def _get_quality_llm():
    global quality_llm
    if quality_llm is None:
        quality_llm = get_quality_llm()
    return quality_llm


async def generate_letter_for_user(
    conn, user_id: str, week_start: date, week_end: date
) -> None:
    notes = await fetchall(
        conn,
        """
        SELECT n.content, n.created_at, n.emotion_score,
               array_agg(c.name) as category_names
        FROM notes n
        LEFT JOIN note_categories nc ON nc.note_id = n.id
        LEFT JOIN categories c ON c.id = nc.category_id
        WHERE n.user_id = %s AND n.created_at::date BETWEEN %s AND %s
        GROUP BY n.id ORDER BY n.created_at
        """,
        (user_id, week_start, week_end),
    )

    if len(notes) < MIN_NOTES_FOR_LETTER:
        logger.info("Skipping letter for user %s — only %d notes", user_id, len(notes))
        return

    notes_text = "\n\n".join(
        f"[{n['created_at'][:10]}] ({', '.join(filter(None, n['category_names'] or []))})\n{n['content']}"
        for n in notes
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", WEEKLY_LETTER_SYSTEM_PROMPT),
        ("human", "Write my weekly letter."),
    ])
    chain = prompt | _get_quality_llm()
    response = await chain.ainvoke({"notes_text": notes_text})

    await conn.execute(
        "INSERT INTO weekly_letters (user_id, content, week_start, week_end) "
        "VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (user_id, week_start) DO UPDATE SET content = EXCLUDED.content",
        (user_id, response.content, week_start, week_end),
    )


async def run_weekly_letters() -> None:
    from ..db import get_pool
    today = date.today()
    week_end = today
    week_start = today - timedelta(days=6)
    pool = await get_pool()
    async with pool.connection() as conn:
        users = await fetchall(conn, "SELECT DISTINCT user_id FROM notes")
        for user in users:
            await generate_letter_for_user(conn, user["user_id"], week_start, week_end)
