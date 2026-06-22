"""Extraction pipeline: convert raw journal text to structured notes via LangChain.

This module builds a LangChain chain that:
1. Takes raw journal text as input
2. Sends it to Groq Llama-3.1-8B with the extraction system prompt
3. Parses the structured output into ExtractionResult (via Pydantic)
4. Returns the result asynchronously

The chain is module-level so tests can patch nara_worker.pipeline.extraction._chain.
"""

from langchain_core.prompts import ChatPromptTemplate

from ..clients.groq import get_fast_llm
from ..models import ExtractionResult, ExtractedNote, ExtractedEntity
from ..prompts.extraction import EXTRACTION_SYSTEM_PROMPT

# Re-export so tests can import these from nara_worker.pipeline.extraction
__all__ = ["extract_from_text", "ExtractionResult", "ExtractedNote", "ExtractedEntity"]

_prompt = ChatPromptTemplate.from_messages([
    ("system", EXTRACTION_SYSTEM_PROMPT),
    ("human", "Extract memories from this text:\n\n{text}"),
])

# Lazy chain: None until first use
_chain = None


async def extract_from_text(text: str) -> ExtractionResult:
    """Extract structured notes from raw journal text.

    Args:
        text: The raw journal entry text to extract from.

    Returns:
        An ExtractionResult containing a list of ExtractedNote objects.

    Raises:
        ValueError: If the LLM output does not parse as ExtractionResult.
    """
    global _chain
    if _chain is None:
        _chain = _prompt | get_fast_llm().with_structured_output(ExtractionResult)
    return await _chain.ainvoke({"text": text})
