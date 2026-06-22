"""Tests for the extraction pipeline.

These tests mock the LangChain chain and verify that:
1. extract_from_text returns ExtractionResult with multiple notes
2. The returned objects have the correct types
3. Categories and intentions are properly extracted
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from nara_worker.pipeline.extraction import (
    extract_from_text,
    ExtractionResult,
    ExtractedNote,
)

GOLDEN_INPUT = (
    "I'm overwhelmed by the project deadline. Slides not started. "
    "Rohan texted but I couldn't reply. Reading Atomic Habits."
)


@pytest.mark.asyncio
async def test_extract_returns_multiple_notes():
    """Verify that extract_from_text returns multiple notes from a single input."""
    mock_result = ExtractionResult(notes=[
        ExtractedNote(
            content="Overwhelmed by project deadline. Slides not started.",
            categories=["Work"],
            emotion_score=-0.7,
            entities=[],
            intentions=[],
        ),
        ExtractedNote(
            content="Rohan texted, couldn't reply.",
            categories=["Rohan"],
            emotion_score=-0.3,
            entities=[],
            intentions=["Reply to Rohan"],
        ),
        ExtractedNote(
            content="Reading Atomic Habits.",
            categories=["Books"],
            emotion_score=0.2,
            entities=[],
            intentions=[],
        ),
    ])
    # Mock the fast LLM and its structured output method
    with patch("nara_worker.pipeline.extraction.get_fast_llm") as mock_get_llm:
        mock_llm = MagicMock()
        mock_get_llm.return_value = mock_llm

        # Mock the chain: prompt | llm.with_structured_output(...)
        mock_chain = AsyncMock()
        mock_chain.ainvoke = AsyncMock(return_value=mock_result)
        mock_llm.with_structured_output.return_value = mock_chain

        # Mock the pipe operation on the prompt
        with patch("nara_worker.pipeline.extraction._prompt") as mock_prompt:
            mock_prompt.__or__ = MagicMock(return_value=mock_chain)

            # Reset _chain to force reinitialisation
            import nara_worker.pipeline.extraction
            nara_worker.pipeline.extraction._chain = None

            result = await extract_from_text(GOLDEN_INPUT)

    assert len(result.notes) >= 2
    categories = [cat for note in result.notes for cat in note.categories]
    assert "Work" in categories


@pytest.mark.asyncio
async def test_extract_returns_extraction_result_type():
    """Verify that extract_from_text returns the correct type hierarchy."""
    mock_result = ExtractionResult(notes=[
        ExtractedNote(
            content="test",
            categories=["Work"],
            emotion_score=0.0,
            entities=[],
            intentions=[],
        )
    ])
    # Mock the fast LLM and its structured output method
    with patch("nara_worker.pipeline.extraction.get_fast_llm") as mock_get_llm:
        mock_llm = MagicMock()
        mock_get_llm.return_value = mock_llm

        # Mock the chain: prompt | llm.with_structured_output(...)
        mock_chain = AsyncMock()
        mock_chain.ainvoke = AsyncMock(return_value=mock_result)
        mock_llm.with_structured_output.return_value = mock_chain

        # Mock the pipe operation on the prompt
        with patch("nara_worker.pipeline.extraction._prompt") as mock_prompt:
            mock_prompt.__or__ = MagicMock(return_value=mock_chain)

            # Reset _chain to force reinitialisation
            import nara_worker.pipeline.extraction
            nara_worker.pipeline.extraction._chain = None

            result = await extract_from_text("test input")

    assert isinstance(result, ExtractionResult)
    assert all(isinstance(n, ExtractedNote) for n in result.notes)
