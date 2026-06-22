from langchain_postgres import PGVector
from langchain_core.prompts import ChatPromptTemplate
from ..clients.openai import get_embeddings
from ..clients.groq import get_quality_llm
from ..config import get_settings
from ..prompts.ask_nara import ASK_NARA_SYSTEM_PROMPT

# Lazy-loaded module-level so tests can patch nara_worker.rag.ask_nara.quality_llm
quality_llm = None


def _get_vector_store(user_id: str) -> PGVector:
    s = get_settings()
    return PGVector(
        embeddings=get_embeddings(),
        collection_name=f"notes_{user_id}",
        connection=s.database_url,
    )


async def ask_nara(user_id: str, question: str, k: int = 10) -> dict:
    global quality_llm
    if quality_llm is None:
        quality_llm = get_quality_llm()

    vector_store = _get_vector_store(user_id)
    docs = await vector_store.asimilarity_search(question, k=k)

    if not docs:
        return {
            "answer": "I haven't heard you mention that yet.",
            "cited_note_ids": [],
        }

    context = "\n\n".join(
        f"[{doc.metadata.get('note_id', 'unknown')}] {doc.page_content}"
        for doc in docs
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", ASK_NARA_SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    chain = prompt | quality_llm
    response = await chain.ainvoke({"context": context, "question": question})

    cited_ids = [
        doc.metadata["note_id"]
        for doc in docs
        if "note_id" in doc.metadata
    ]
    return {"answer": response.content, "cited_note_ids": cited_ids}
