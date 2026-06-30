from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


@pytest.mark.asyncio
async def test_embed_note_inserts_vector():
    conn = AsyncMock()
    conn.execute = AsyncMock()

    mock_embeddings = MagicMock()
    mock_embeddings.aembed_query = AsyncMock(return_value=[0.1] * 1536)

    with patch("nara_worker.clients.openai.get_embeddings", return_value=mock_embeddings), \
         patch("nara_worker.pipeline.embedding.record_event", AsyncMock()):
        from nara_worker.pipeline.embedding import embed_note
        result = await embed_note(
            conn=conn,
            note_id=str(uuid4()),
            user_id=str(uuid4()),
            content="Test note content",
        )

    assert result is True
    conn.execute.assert_called_once()
    sql = conn.execute.call_args[0][0]
    assert "note_embeddings" in sql
    assert "::vector" in sql


@pytest.mark.asyncio
async def test_embed_note_returns_false_on_api_error():
    conn = AsyncMock()

    mock_embeddings = MagicMock()
    mock_embeddings.aembed_query = AsyncMock(side_effect=Exception("OpenAI API error"))

    with patch("nara_worker.clients.openai.get_embeddings", return_value=mock_embeddings), \
         patch("nara_worker.pipeline.embedding.record_event", AsyncMock()):
        from nara_worker.pipeline.embedding import embed_note
        result = await embed_note(
            conn=conn,
            note_id=str(uuid4()),
            user_id=str(uuid4()),
            content="Test",
        )

    assert result is False
    conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_embed_note_returns_false_on_db_error():
    conn = AsyncMock()
    conn.execute = AsyncMock(side_effect=Exception("DB connection lost"))

    mock_embeddings = MagicMock()
    mock_embeddings.aembed_query = AsyncMock(return_value=[0.0] * 1536)

    with patch("nara_worker.clients.openai.get_embeddings", return_value=mock_embeddings), \
         patch("nara_worker.pipeline.embedding.record_event", AsyncMock()):
        from nara_worker.pipeline.embedding import embed_note
        result = await embed_note(
            conn=conn,
            note_id=str(uuid4()),
            user_id=str(uuid4()),
            content="Test",
        )

    assert result is False
