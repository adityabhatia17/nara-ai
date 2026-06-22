import pytest
from unittest.mock import patch
from nara_worker.config import Settings
from nara_worker.clients.groq import get_fast_llm, get_quality_llm
from nara_worker.clients.openai import get_embeddings


@pytest.fixture
def mock_settings():
    """Provide mock settings with valid API keys."""
    settings = Settings(
        groq_api_key="gsk_test_key_1234567890",
        groq_model_fast="llama-3.1-8b-instant",
        groq_model_quality="llama-3.3-70b-versatile",
        openai_api_key="sk-test_key_1234567890",
        embedding_model="text-embedding-3-small",
    )
    return settings


def test_fast_llm_model_name(mock_settings):
    with patch("nara_worker.clients.groq.get_settings", return_value=mock_settings):
        llm = get_fast_llm()
        assert "8b" in llm.model_name.lower() or "instant" in llm.model_name.lower()


def test_quality_llm_model_name(mock_settings):
    with patch("nara_worker.clients.groq.get_settings", return_value=mock_settings):
        llm = get_quality_llm()
        assert "70b" in llm.model_name.lower() or "versatile" in llm.model_name.lower()


def test_embeddings_model_name(mock_settings):
    with patch("nara_worker.clients.openai.get_settings", return_value=mock_settings):
        emb = get_embeddings()
        assert emb.model == "text-embedding-3-small"


def test_fast_llm_temperature_is_zero(mock_settings):
    with patch("nara_worker.clients.groq.get_settings", return_value=mock_settings):
        llm = get_fast_llm()
        assert llm.temperature < 0.001  # LangChain converts 0 → ~1e-08


def test_quality_llm_temperature_is_not_zero(mock_settings):
    with patch("nara_worker.clients.groq.get_settings", return_value=mock_settings):
        llm = get_quality_llm()
        assert llm.temperature > 0
