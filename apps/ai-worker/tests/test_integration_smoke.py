"""Integration smoke test — requires real DATABASE_URL + GROQ_API_KEY in .env.

Run manually with: uv run pytest tests/test_integration_smoke.py -v -s
Skipped automatically in CI if DATABASE_URL is unset.
"""

from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL") or not os.getenv("GROQ_API_KEY"),
    reason="Requires real DATABASE_URL and GROQ_API_KEY",
)


@pytest.mark.asyncio
async def test_extraction_smoke():
    """Verify extraction returns structured notes for a known input."""
    from nara_worker.pipeline.extraction import extract_from_text

    text = "I'm stressed about the project deadline. Rohan called but I missed it."
    extraction = await extract_from_text(text)

    assert len(extraction.notes) >= 1

    all_categories = [c for note in extraction.notes for c in note.categories]
    has_work = any(
        "work" in c.lower() or "project" in c.lower() or "deadline" in c.lower()
        for c in all_categories
    )
    assert has_work, f"Expected a work-related category, got: {all_categories}"

    all_entity_names = [e.name.lower() for note in extraction.notes for e in note.entities]
    has_rohan = any("rohan" in name for name in all_entity_names)
    assert has_rohan, f"Expected Rohan entity, got: {all_entity_names}"


@pytest.mark.asyncio
async def test_extraction_rejects_unresolved_pronouns():
    """Extraction model should resolve pronouns — the validator is a safety net."""
    from nara_worker.models import ExtractedEntity

    with pytest.raises(ValueError, match="unresolved pronoun"):
        ExtractedEntity(name="he", type="person", context_snippet=None)


def test_extraction_model_validation():
    """Verify the extraction model accepts valid notes."""
    from nara_worker.models import ExtractedNote, ExtractedEntity

    note = ExtractedNote(
        content="Test note with an entity.",
        categories=["Work", "Personal"],
        emotion_score=0.5,
        entities=[
            ExtractedEntity(
                name="Alice",
                type="person",
                context_snippet="Alice mentioned a problem",
            )
        ],
        intentions=["Follow up with Alice"],
    )

    assert note.content == "Test note with an entity."
    assert len(note.categories) == 2
    assert note.emotion_score == 0.5
    assert len(note.entities) == 1
    assert note.entities[0].name == "Alice"
    assert len(note.intentions) == 1
