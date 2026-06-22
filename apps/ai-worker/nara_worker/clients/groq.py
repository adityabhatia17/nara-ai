from langchain_groq import ChatGroq
from ..config import get_settings


def _make_llm(model: str, temperature: float) -> ChatGroq:
    s = get_settings()
    return ChatGroq(
        model=model,
        api_key=s.groq_api_key,
        temperature=temperature,
    )


def get_fast_llm() -> ChatGroq:
    """llama-3.1-8b-instant — used for entity extraction (high frequency)."""
    return _make_llm(get_settings().groq_model_fast, temperature=0)


def get_quality_llm() -> ChatGroq:
    """llama-3.3-70b-versatile — used for weekly letters and Ask Nara."""
    return _make_llm(get_settings().groq_model_quality, temperature=0.7)
