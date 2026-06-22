from langchain_core.prompts import ChatPromptTemplate
from ..clients.openai import get_embeddings
from ..clients.groq import get_quality_llm
from ..db import get_pool
from ..prompts.ask_nara import ASK_NARA_SYSTEM_PROMPT

# Lazy-loaded module-level so tests can patch nara_worker.rag.ask_nara.quality_llm
quality_llm = None


async def ask_nara(user_id: str, question: str, k: int = 10) -> dict:
    """Answer a question using RAG over the user's note embeddings.

    Queries note_embeddings directly via pgvector cosine similarity,
    then generates an answer using the quality LLM with the retrieved notes as context.
    """
    global quality_llm
    if quality_llm is None:
        quality_llm = get_quality_llm()

    # Embed the question
    embeddings = get_embeddings()
    query_vector = await embeddings.aembed_query(question)

    # Retrieve top-k notes by cosine similarity
    pool = await get_pool()
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT ne.note_id, n.content,
                   1 - (ne.embedding <=> %s::vector) AS similarity
            FROM note_embeddings ne
            JOIN notes n ON n.id = ne.note_id
            WHERE ne.user_id = %s
            ORDER BY ne.embedding <=> %s::vector
            LIMIT %s
            """,
            (query_vector, user_id, query_vector, k),
        )
        rows = await cur.fetchall()

    if not rows:
        return {
            "answer": "I haven't heard you mention that yet.",
            "cited_note_ids": [],
        }

    context = "\n\n".join(
        f"[{row['note_id']}] {row['content']}"
        for row in rows
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", ASK_NARA_SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    chain = prompt | quality_llm
    response = await chain.ainvoke({"context": context, "question": question})

    cited_ids = [row["note_id"] for row in rows]
    return {"answer": response.content, "cited_note_ids": cited_ids}
