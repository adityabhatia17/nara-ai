import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

# ask_nara now retrieves via raw pgvector SQL (get_pool → conn.execute → cur.fetchall),
# embeds the question via get_embeddings(), and generates with the module-level
# quality_llm. Tests mock those three seams.


def _make_pool_with_rows(rows):
    cur = AsyncMock()
    cur.fetchall = AsyncMock(return_value=rows)
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=cur)
    pool = AsyncMock()
    pool.connection = MagicMock(
        return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=conn),
            __aexit__=AsyncMock(return_value=False),
        )
    )
    return pool


def _make_embeddings():
    emb = MagicMock()
    emb.aembed_query = AsyncMock(return_value=[0.1] * 1536)
    return emb


@pytest.mark.asyncio
async def test_ask_returns_answer_and_cited_ids():
    note_id = str(uuid4())
    rows = [{"note_id": note_id, "content": "Work stress has been high this week.", "similarity": 0.9}]
    pool = _make_pool_with_rows(rows)

    mock_llm = MagicMock()  # coerced into the prompt | llm chain

    with patch("nara_worker.rag.ask_nara.get_pool", AsyncMock(return_value=pool)), \
         patch("nara_worker.rag.ask_nara.get_embeddings", return_value=_make_embeddings()), \
         patch("nara_worker.rag.ask_nara.quality_llm", mock_llm):
        from nara_worker.rag.ask_nara import ask_nara
        result = await ask_nara(user_id=str(uuid4()), question="What have I said about work?")

    assert "answer" in result
    assert "cited_note_ids" in result
    assert isinstance(result["cited_note_ids"], list)
    assert result["cited_note_ids"] == [note_id]


@pytest.mark.asyncio
async def test_ask_returns_no_data_message_when_empty_retrieval():
    pool = _make_pool_with_rows([])  # no matching notes

    with patch("nara_worker.rag.ask_nara.get_pool", AsyncMock(return_value=pool)), \
         patch("nara_worker.rag.ask_nara.get_embeddings", return_value=_make_embeddings()), \
         patch("nara_worker.rag.ask_nara.quality_llm", MagicMock()):
        from nara_worker.rag.ask_nara import ask_nara
        result = await ask_nara(user_id=str(uuid4()), question="Tell me about surfing")

    assert result["cited_note_ids"] == []
    assert result["answer"] == "I haven't heard you mention that yet."
