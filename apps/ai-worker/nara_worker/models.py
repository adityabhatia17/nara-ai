"""Pydantic v2 models — the structured contracts the pipeline validates against.

These mirror the extraction JSON schema in CLAUDE_BACKEND.md §7 / ARCHITECTURE.md §4
and the DB rows in DATABASE_SCHEMA.md. The extractor's output is validated against
:class:`ExtractionResult`; anything that doesn't parse triggers a reprompt.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EntityType = Literal["person", "topic", "place", "other"]


class ExtractedEntity(BaseModel):
    """One entity mention inside a note, already co-reference-resolved.

    ``name`` is the canonical surface form ("Rohan"), never a pronoun or alias —
    co-reference resolution happens inside the extraction prompt (Rule #2 / #11).
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    type: EntityType
    context_snippet: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def _reject_pronouns(cls, v: str) -> str:
        # Defensive: the prompt is told to resolve these, but never trust the 8B
        # model blindly. A bare pronoun means co-reference failed for this mention.
        bare = v.strip().lower()
        if bare in {"he", "she", "they", "him", "her", "them", "it"}:
            raise ValueError(f"unresolved pronoun left as entity name: {v!r}")
        return v


class ExtractedNote(BaseModel):
    """One atomic note carved out of an entry (Rule #1: one entry -> many notes)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=1)
    categories: list[str] = Field(default_factory=list)
    emotion_score: float | None = Field(default=None, ge=-1.0, le=1.0)
    entities: list[ExtractedEntity] = Field(default_factory=list)
    intentions: list[str] = Field(default_factory=list)

    @field_validator("categories", "intentions", mode="before")
    @classmethod
    def _drop_blanks(cls, v: object) -> object:
        if isinstance(v, list):
            return [s.strip() for s in v if isinstance(s, str) and s.strip()]
        return v


class ExtractionResult(BaseModel):
    """Top-level extractor output: the list of notes for one entry."""

    notes: list[ExtractedNote] = Field(default_factory=list)
