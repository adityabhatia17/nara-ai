import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


@pytest.mark.asyncio
async def test_ask_returns_answer_and_cited_ids():
    mock_doc = MagicMock()
    mock_doc.page_content = "Work stress has been high this week."
    mock_doc.metadata = {"note_id": str(uuid4())}

    with patch("nara_worker.rag.ask_nara._get_vector_store") as mock_vs_fn, \
         patch("nara_worker.rag.ask_nara.quality_llm") as mock_llm:
        mock_vs = MagicMock()
        mock_vs.asimilarity_search = AsyncMock(return_value=[mock_doc])
        mock_vs_fn.return_value = mock_vs
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="You mentioned work stress 3 times."))

        from nara_worker.rag.ask_nara import ask_nara
        result = await ask_nara(user_id=str(uuid4()), question="What have I said about work?")

    assert "answer" in result
    assert "cited_note_ids" in result
    assert isinstance(result["cited_note_ids"], list)


@pytest.mark.asyncio
async def test_ask_returns_no_data_message_when_empty_retrieval():
    with patch("nara_worker.rag.ask_nara._get_vector_store") as mock_vs_fn, \
         patch("nara_worker.rag.ask_nara.quality_llm") as mock_llm:
        mock_vs = MagicMock()
        mock_vs.asimilarity_search = AsyncMock(return_value=[])
        mock_vs_fn.return_value = mock_vs
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="I haven't heard you mention that yet."))

        from nara_worker.rag.ask_nara import ask_nara
        result = await ask_nara(user_id=str(uuid4()), question="Tell me about surfing")

    assert result["cited_note_ids"] == []
