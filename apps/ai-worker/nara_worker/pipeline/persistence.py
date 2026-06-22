from uuid import uuid4

CATEGORY_COLORS = {
    "work": "#BE6E45", "books": "#B5913F",
    "family": "#B27079", "people": "#7E9270",
}
FALLBACK_COLORS = ["#7E9270", "#B5913F", "#B27079", "#BE6E45", "#6B8FA3", "#9A7FB5"]


def canonical_pair(a: str, b: str) -> tuple[str, str]:
    """Return (smaller_id, larger_id) to prevent duplicate co-occurrence storage."""
    if a == b:
        raise ValueError("Cannot create co-occurrence with self")
    return (a, b) if a < b else (b, a)


async def find_or_create_category(conn, user_id: str, name: str) -> str:
    lower = name.lower()
    color = CATEGORY_COLORS.get(lower, FALLBACK_COLORS[hash(lower) % len(FALLBACK_COLORS)])
    row = await conn.fetchone(
        "INSERT INTO categories (user_id, name, color) VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id, lower(name)) DO UPDATE SET name=EXCLUDED.name "
        "RETURNING id",
        (user_id, name, color),
    )
    return row["id"]


async def find_or_create_entity(conn, user_id: str, name: str, entity_type: str) -> str:
    row = await conn.fetchone(
        "INSERT INTO entities (user_id, name, entity_type) VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id, entity_type, lower(name)) DO UPDATE SET "
        "mention_count = entities.mention_count + 1, "
        "last_mentioned_at = now() RETURNING id",
        (user_id, name, entity_type),
    )
    return row["id"]


async def upsert_cooccurrence(conn, user_id: str, entity_ids: list[str]) -> None:
    pairs: set[tuple[str, str]] = set()
    for i, a in enumerate(entity_ids):
        for b in entity_ids[i + 1 :]:
            pairs.add(canonical_pair(a, b))
    for a, b in pairs:
        await conn.execute(
            "INSERT INTO entity_cooccurrences (user_id, entity_a_id, entity_b_id) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (user_id, entity_a_id, entity_b_id) "
            "DO UPDATE SET count = entity_cooccurrences.count + 1, last_seen_at = now()",
            (user_id, a, b),
        )


async def save_notes_from_extraction(conn, user_id: str, entry_id: str, extraction) -> list[str]:
    note_ids = []
    for extracted in extraction.notes:
        note_id = str(uuid4())
        await conn.execute(
            "INSERT INTO notes (id, user_id, entry_id, content, emotion_score) "
            "VALUES (%s, %s, %s, %s, %s)",
            (note_id, user_id, entry_id, extracted.content, extracted.emotion_score),
        )
        for cat_name in extracted.categories:
            cat_id = await find_or_create_category(conn, user_id, cat_name)
            await conn.execute(
                "INSERT INTO note_categories (note_id, category_id) VALUES (%s, %s) "
                "ON CONFLICT DO NOTHING",
                (note_id, cat_id),
            )
            await conn.execute(
                "UPDATE categories SET note_count = note_count + 1 WHERE id = %s",
                (cat_id,),
            )
        entity_ids = []
        for ent in extracted.entities:
            eid = await find_or_create_entity(conn, user_id, ent.name, ent.type)
            entity_ids.append(eid)
            await conn.execute(
                "INSERT INTO note_entities (note_id, entity_id, context_snippet) "
                "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (note_id, eid, ent.context_snippet),
            )
        if len(entity_ids) > 1:
            await upsert_cooccurrence(conn, user_id, entity_ids)
        for intention in extracted.intentions:
            await conn.execute(
                "INSERT INTO loose_ends (user_id, note_id, intention_text) VALUES (%s, %s, %s)",
                (user_id, note_id, intention),
            )
        note_ids.append(note_id)
    return note_ids
