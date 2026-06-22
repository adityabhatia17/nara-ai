from langchain_openai import OpenAIEmbeddings
from ..config import get_settings


def get_embeddings() -> OpenAIEmbeddings:
    """text-embedding-3-small — the one closed-model dependency (ARCHITECTURE.md §2.8)."""
    s = get_settings()
    return OpenAIEmbeddings(
        model=s.embedding_model,
        api_key=s.openai_api_key,
    )
