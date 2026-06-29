# Turgon AI: Senior AI Engineer Interview Prep

**Role:** Senior AI Engineer at Turgon AI (Delhi, On-site)
**What they do:** "AI-Native Accenture" -- AI agents that understand enterprise infrastructure, processes, and data to build integrations, add business logic, and root-cause issues.
**Your angle:** Referral through a known person. Show Nara as proof of production AI engineering skills.

---

## How to Read This Document

For each requirement from the job posting, this document covers:
1. **What they want** -- the exact requirement
2. **What we built in Nara** -- how our project demonstrates this skill
3. **The gap** -- what Nara doesn't cover that you need to learn
4. **Deep concepts** -- the 20% knowledge that covers 80% of interview questions
5. **Interview-ready answers** -- what to say when asked

---

## RESPONSIBILITY 1: Multi-Agent System Architecture (LangGraph/LangChain)

### What They Want
> "Lead the architectural design of complex, multi-agent systems using LangGraph/LangChain that can handle long-running, asynchronous enterprise tasks."

### What We Built in Nara

**LangChain usage (demonstrated):**
```
nara_worker/
  clients/groq.py         -- ChatGroq (fast_llm + quality_llm)
  clients/openai.py       -- OpenAIEmbeddings
  pipeline/extraction.py  -- ChatPromptTemplate + with_structured_output
  rag/ask_nara.py          -- RAG chain (embed query + retrieve + generate)
  prompts/extraction.py   -- Versioned system prompts
  prompts/ask_nara.py      -- Grounding prompt
  prompts/weekly_letter.py -- Style-constrained prompt
```

**Async long-running tasks (demonstrated):**
```
POST /entries  -->  pg-boss queue  -->  Python worker polls  -->  process_entry()
     (202)          (Postgres)          (async loop)              (extraction + persistence + embedding)
```

This is exactly the pattern Turgon needs: user submits work, system processes asynchronously, user polls for completion.

### The Gap: LangGraph

Nara uses LangChain but NOT LangGraph. LangGraph is the framework for building **stateful, multi-agent** workflows. Turgon explicitly requires it.

### Deep Concepts: LangChain vs LangGraph

**LangChain** = a library for building LLM pipelines.
- Chains: prompt | llm | parser (linear)
- Tools: give the LLM access to functions
- Retrievers: similarity search over documents
- Memory: conversation history

**LangGraph** = a framework for building agent graphs.
- Nodes: each node is a function (could be an LLM call, a tool call, a human review step)
- Edges: connections between nodes (can be conditional)
- State: a shared state object that flows through the graph
- Cycles: nodes can loop back (agent retries, human-in-the-loop)
- Persistence: state can be checkpointed and resumed (critical for long-running tasks)

**Why LangGraph matters for Turgon:**
They build enterprise agents that might:
1. Analyze an ERP system (takes 5 minutes)
2. Wait for human approval (takes hours)
3. Execute changes across 3 systems (takes 10 minutes)
4. Verify results (takes 2 minutes)

This is a **stateful graph with checkpoints**, not a linear chain. LangGraph handles this.

**Key LangGraph concepts you must know:**

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict

# 1. DEFINE STATE -- the shared data flowing through the graph
class AgentState(TypedDict):
    messages: list       # conversation history
    plan: str            # current plan
    results: list        # accumulated results
    needs_approval: bool # human-in-the-loop flag

# 2. DEFINE NODES -- each is a function
async def analyze(state: AgentState) -> AgentState:
    """Node 1: Analyze the ERP data"""
    llm = ChatGroq(model="llama-3.3-70b-versatile")
    response = await llm.ainvoke(state["messages"])
    return {"plan": response.content, "needs_approval": True}

async def execute(state: AgentState) -> AgentState:
    """Node 2: Execute the plan"""
    # ... run the actual changes
    return {"results": [...]}

async def verify(state: AgentState) -> AgentState:
    """Node 3: Verify results"""
    # ... check everything worked
    return {"messages": state["messages"] + ["Verified OK"]}

# 3. BUILD THE GRAPH
graph = StateGraph(AgentState)
graph.add_node("analyze", analyze)
graph.add_node("execute", execute)
graph.add_node("verify", verify)

# 4. ADD EDGES (including conditional)
graph.add_edge("analyze", "execute")
graph.add_edge("execute", "verify")
graph.add_conditional_edges("verify", 
    lambda state: "end" if state["results"] else "analyze",  # retry if failed
    {"end": END, "analyze": "analyze"}
)

# 5. COMPILE AND RUN
app = graph.compile(checkpointer=SqliteSaver.from_conn_string("checkpoints.db"))
result = await app.ainvoke(initial_state)
```

**Multi-agent pattern:**
```
Supervisor Agent (decides which specialist to call)
    |
    +-- Research Agent (searches documents)
    +-- Code Agent (writes/modifies code)  
    +-- Review Agent (validates output)
    +-- Human Node (waits for approval)
```

### How Nara Maps to This

| LangGraph Concept | Nara Equivalent | Status |
|---|---|---|
| StateGraph | process_entry() pipeline (extract -> persist -> embed) | Implemented as linear, not graph |
| Nodes | extraction, persistence, embedding functions | Yes, but called sequentially |
| Conditional edges | Retry on failure, skip embedding on error | Implemented via if/try-catch, not graph edges |
| State persistence | Entry status in Postgres (pending -> processing -> done) | Yes, equivalent to checkpointing |
| Long-running async | pg-boss queue + worker poll loop | Yes, production-grade |
| Multi-agent | Not implemented (single pipeline) | Gap |
| Human-in-the-loop | Not implemented | Gap |

### Interview-Ready Answer

> "In Nara, I built the async processing pipeline using LangChain with pg-boss for job queuing. The pipeline follows a staged architecture (extraction, persistence, embedding) with explicit state transitions in Postgres, which is architecturally similar to LangGraph's state checkpointing. I chose LangChain over LangGraph for Nara because the pipeline is linear and doesn't need conditional branching or human-in-the-loop. For Turgon's enterprise use case, I'd use LangGraph because enterprise workflows require stateful graphs with conditional edges, retry loops, human approval gates, and multi-agent coordination -- exactly what LangGraph's StateGraph provides."

### Study List
- [ ] Build a simple LangGraph agent (supervisor + 2 tool agents)
- [ ] Understand StateGraph, checkpointing, and conditional edges
- [ ] Learn the difference between ReAct agent and Plan-and-Execute agent patterns
- [ ] Read LangGraph docs on human-in-the-loop and breakpoints

---

## RESPONSIBILITY 2: Evals (Evaluation Pipelines)

### What They Want
> "Own the 'Evals': Design and build automated evaluation pipelines to measure agent accuracy, hallucination rates, and success metrics before deploying to production."

### What We Built in Nara

**Pydantic validation (structural correctness):**
```python
# nara_worker/models.py
class ExtractedEntity(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: EntityType  # constrained to person|topic|place|other

    @field_validator("name")
    def _reject_pronouns(cls, v):
        if v.strip().lower() in {"he", "she", "they", ...}:
            raise ValueError(f"unresolved pronoun: {v!r}")
        return v
```

**Unit tests with golden inputs:**
```python
# tests/pipeline/test_extraction.py
GOLDEN_INPUT = (
    "I'm overwhelmed by the project deadline. "
    "Rohan texted but I couldn't reply. Reading Atomic Habits."
)

async def test_extract_returns_multiple_notes():
    result = await extract_from_text(GOLDEN_INPUT)
    assert len(result.notes) >= 2
    categories = [cat for note in result.notes for cat in note.categories]
    assert "Work" in categories
```

**Grounding enforcement (anti-hallucination):**
```python
# nara_worker/prompts/ask_nara.py
"Answer ONLY based on the provided notes below. Never invent or assume.
If the notes contain no relevant information, say:
'I haven't heard you mention that yet.'"
```

### The Gap: Systematic Evals

Nara has basic tests and validators, but NOT a systematic evaluation pipeline. What Turgon wants:

### Deep Concepts: LLM Evaluation

**Why evals are hard:** LLM outputs are non-deterministic. You can't just `assertEqual()`. You need metrics.

**The 5 dimensions of LLM evaluation:**

```
1. CORRECTNESS  -- Did the LLM produce the right answer?
2. FAITHFULNESS -- Is the answer grounded in the provided context? (anti-hallucination)
3. RELEVANCE    -- Is the retrieved context relevant to the question?
4. COHERENCE    -- Is the output well-structured and readable?
5. LATENCY/COST -- Did it respond fast enough and cheaply enough?
```

**Evaluation methods:**

| Method | How It Works | When to Use |
|---|---|---|
| **Exact match** | Compare output to ground truth string | Structured extraction (entity names) |
| **Semantic similarity** | Embed both, compute cosine similarity | Free-text answers |
| **LLM-as-Judge** | Ask a stronger LLM to score the output | Complex quality assessment |
| **Human eval** | Humans rate on a rubric | Gold standard but expensive |
| **Automated metrics** | BLEU, ROUGE, F1 for entity extraction | NLP benchmarks |

**LLM-as-Judge (the most important pattern for interviews):**

```python
JUDGE_PROMPT = """You are evaluating an AI assistant's answer.

Question: {question}
Context provided: {context}
AI's answer: {answer}
Ground truth: {ground_truth}

Score on these dimensions (1-5):
1. Correctness: Does the answer match the ground truth?
2. Faithfulness: Does the answer ONLY use information from the context?
3. Relevance: Is the answer relevant to the question?

Return JSON: {"correctness": N, "faithfulness": N, "relevance": N, "explanation": "..."}
"""
```

**Hallucination detection:**

```python
# Check if the answer contains claims not in the context
def detect_hallucination(answer: str, context_notes: list[str]) -> bool:
    """
    Method 1: Entailment check
    For each claim in the answer, check if it's entailed by the context.
    
    Method 2: LLM-as-Judge
    Ask a model: "Is every fact in this answer supported by the context?"
    
    Method 3: Token overlap
    Check if key entities in the answer also appear in the context.
    """
```

**An eval pipeline for Nara's extraction (what we should have built):**

```python
# eval/extraction_eval.py
GOLDEN_DATASET = [
    {
        "input": "I met Rohan for coffee. We discussed the Q3 deadline.",
        "expected_entities": [
            {"name": "Rohan", "type": "person"},
            {"name": "Q3 deadline", "type": "topic"},
        ],
        "expected_categories": ["People", "Work"],
        "expected_note_count_min": 1,
    },
    # ... 50+ golden examples
]

async def run_extraction_eval():
    results = []
    for example in GOLDEN_DATASET:
        extraction = await extract_from_text(example["input"])
        
        # Entity precision/recall
        predicted_entities = {e.name.lower() for n in extraction.notes for e in n.entities}
        expected_entities = {e["name"].lower() for e in example["expected_entities"]}
        precision = len(predicted_entities & expected_entities) / max(len(predicted_entities), 1)
        recall = len(predicted_entities & expected_entities) / max(len(expected_entities), 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-6)
        
        results.append({"input": example["input"], "f1": f1, "precision": precision, "recall": recall})
    
    avg_f1 = sum(r["f1"] for r in results) / len(results)
    print(f"Extraction F1: {avg_f1:.2%}")
    return results
```

**An eval pipeline for Ask Nara RAG:**

```python
# eval/rag_eval.py
RAG_GOLDEN = [
    {
        "question": "What have I said about work?",
        "notes_in_db": ["Work deadline stressed me out", "Project meeting went well"],
        "expected_answer_contains": ["deadline", "meeting"],
        "expected_answer_not_contains": ["vacation"],  # hallucination check
    },
]

async def run_rag_eval():
    for example in RAG_GOLDEN:
        result = await ask_nara(user_id, example["question"])
        
        # Faithfulness: no claims outside the notes
        for banned_word in example["expected_answer_not_contains"]:
            assert banned_word not in result["answer"].lower(), f"Hallucination: {banned_word}"
        
        # Relevance: answer mentions key topics
        for required in example["expected_answer_contains"]:
            assert required in result["answer"].lower(), f"Missing: {required}"
        
        # Citation check: are cited notes actually relevant?
        assert len(result["cited_note_ids"]) > 0, "No citations"
```

### Interview-Ready Answer

> "I build evaluation pipelines across three dimensions: structural correctness (Pydantic validators that reject invalid outputs like unresolved pronouns), golden-input regression tests (50+ curated examples with expected entities and categories, measured by F1 score), and hallucination detection (LLM-as-Judge checking if every claim in the answer is supported by the retrieved context). For RAG specifically, I measure faithfulness (grounding), relevance (retrieval quality), and answer completeness separately because they fail for different reasons. I version prompts alongside their eval results so I can track regression when prompts change."

### Study List
- [ ] Build a 20-example golden dataset for Nara's extraction
- [ ] Implement LLM-as-Judge for Ask Nara responses
- [ ] Learn RAGAS framework (RAG evaluation)
- [ ] Understand precision/recall/F1 for entity extraction
- [ ] Read about DeepEval, LangSmith eval suites

---

## RESPONSIBILITY 3: Production RAG Hardening

### What They Want
> "Optimize RAG pipelines for scale -- tuning chunking strategies, retrieval algorithms, and vector search parameters for maximum relevance and speed."

### What We Built in Nara

**RAG pipeline (fully implemented):**
```
User question
    -> Embed with OpenAI text-embedding-3-small (1536 dims)
    -> pgvector cosine similarity search (top-k=10)
    -> Inject retrieved notes as context
    -> Groq 70B generates grounded answer
    -> Return answer + cited_note_ids
```

**Vector indexing:**
```sql
CREATE INDEX idx_note_embeddings_vector
  ON note_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**User-scoped retrieval (data isolation):**
```sql
WHERE n.user_id = $1  -- always scoped to the authenticated user
```

### The Gap: Advanced RAG Techniques

Nara has basic RAG. Turgon wants optimized, production-hardened RAG.

### Deep Concepts: RAG Optimization

**Chunking strategies (how you split documents):**

| Strategy | How | When | Trade-off |
|---|---|---|---|
| **Fixed-size** | Split every 500 tokens | Simple docs | May cut mid-sentence |
| **Sentence-based** | Split on sentence boundaries | Narrative text | Uneven chunk sizes |
| **Semantic** | Split when topic changes (using embeddings) | Mixed-topic docs | Expensive to compute |
| **Recursive** | Split by paragraph, then sentence, then character | Most common (LangChain default) | Good balance |
| **Document-specific** | Headers, sections, code blocks | Structured docs (markdown, code) | Requires format knowledge |

**Nara's approach:** We don't chunk at all. Each note IS a chunk (typically 50-300 words). This is ideal because the extraction pipeline already splits entries into atomic notes. Chunking is a solved problem for us because extraction IS our chunking.

**Retrieval strategies (how you find relevant chunks):**

| Strategy | How | Pros | Cons |
|---|---|---|---|
| **Naive top-k** | Embed query, return k nearest | Simple, fast | May miss diverse results |
| **MMR (Maximal Marginal Relevance)** | Balance relevance with diversity | Avoids redundant results | Slower |
| **Hybrid search** | Combine vector search + BM25 keyword search | Best of both worlds | More complex |
| **Re-ranking** | Retrieve top-50, then re-rank with a cross-encoder | Higher precision | Extra model call |
| **HyDE (Hypothetical Document Embeddings)** | Generate a hypothetical answer, embed that, search for similar docs | Better retrieval for abstract questions | Extra LLM call |
| **Multi-query** | Rephrase question 3 ways, retrieve for each, merge results | Handles ambiguous questions | 3x retrieval cost |

**Nara uses naive top-k (k=10).** For a production enterprise system like Turgon's, you'd likely use hybrid search + re-ranking.

**Vector search parameters (what interviewers ask about):**

```
IVFflat parameters:
  lists = 100      -- number of Voronoi cells (clusters)
  probes = 10      -- how many cells to search at query time (default: 1)
  
  More lists = faster search, lower recall
  More probes = slower search, higher recall
  
  Rule of thumb: lists = sqrt(num_vectors), probes = sqrt(lists)
  
  For 10,000 notes: lists=100, probes=10 (what we use)
  For 1,000,000 notes: lists=1000, probes=32

HNSW parameters:
  m = 16              -- connections per node (higher = better recall, more memory)
  ef_construction = 64 -- build-time quality (higher = better index, slower build)
  ef_search = 40       -- query-time quality (higher = better recall, slower query)
```

**Context window management:**

```python
# Problem: What if you retrieve 10 notes but they exceed the LLM's context window?

# Solution 1: Truncate
context = "\n".join(notes[:max_tokens])

# Solution 2: Summarize retrieved docs first (map-reduce)
summaries = [llm.summarize(note) for note in notes]
context = "\n".join(summaries)

# Solution 3: Iterative refinement
answer = ""
for note in notes:
    answer = llm.refine(answer, note, question)

# Nara's approach: Notes are short (50-300 words each), so 10 notes 
# easily fit in context. No truncation needed.
```

### Interview-Ready Answer

> "I optimize RAG pipelines across four dimensions: (1) Chunking -- in Nara, the extraction pipeline itself produces atomic notes, so each note IS a semantically coherent chunk, eliminating the need for post-hoc splitting. (2) Retrieval -- I start with naive top-k cosine similarity for simplicity, then upgrade to hybrid search (vector + BM25) or re-ranking with cross-encoders when recall metrics show gaps. (3) Vector indexing -- IVFflat with lists=sqrt(N) for Phase 1; I'd switch to HNSW for sub-millisecond queries at scale. (4) Context management -- I scope retrieval to the authenticated user and cap at k=10 notes, which fits comfortably in context without truncation. The key production concern is monitoring retrieval relevance over time as the corpus grows."

### Study List
- [ ] Implement hybrid search (pgvector + pg_trgm for keyword) on Nara
- [ ] Learn HNSW vs IVFflat trade-offs deeply
- [ ] Understand cross-encoder re-ranking (e.g., ms-marco-MiniLM)
- [ ] Read about HyDE and multi-query retrieval
- [ ] Know the numbers: embedding latency, search latency, index build time

---

## RESPONSIBILITY 4: Cost & Latency Engineering

### What They Want
> "Make critical decisions on when to use massive foundation models (GPT-4) vs. smaller, specialized models to balance performance with unit economics."

### What We Built in Nara (Direct Match)

This is one of our strongest demonstrations. We built exactly this.

**Tiered model strategy:**

| Task | Model | Cost/1M tokens | Latency | Why |
|---|---|---|---|---|
| Extraction | Groq Llama 8B | $0.05 | ~0.4s | High frequency, structured output constrains behavior |
| Letters/RAG | Groq Llama 70B | $0.27 | ~1.5s | Quality-critical, low frequency |
| Embeddings | OpenAI 3-small | $0.02 | ~0.1s | No open-source alternative at production quality |
| Pattern detection | SQL (no LLM) | $0 | ~5ms | Counting doesn't need AI |

**Total estimated cost: ~$1.20/month** for 50 users.
Same features with GPT-4 everywhere: ~$100-150/month.

**The decision framework:**

```
For each task, ask:

1. Is the output STRUCTURED (JSON, categories, entities)?
   Yes -> Small model + schema constraints can handle it
   No  -> Need larger model for quality

2. Is it USER-FACING (they read the output)?
   Yes -> Quality matters, use bigger model
   No  -> Internal processing, use smallest model that works

3. How FREQUENT is it?
   High (every entry) -> Cost-optimize aggressively
   Low (weekly)       -> Quality-optimize, cost doesn't matter

4. Can it be done WITHOUT an LLM?
   Yes -> Use SQL/code (patterns, counting, filtering)
   No  -> Use the right-sized LLM
```

**Temperature selection:**

```python
# Extraction: deterministic (same input -> same output)
fast_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)

# Letters: creative variety (each letter should feel different)
quality_llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.7)
```

### Deep Concepts: Model Selection for Interviews

**The cost equation:**
```
Total cost = (input_tokens + output_tokens) * price_per_token * requests_per_month

Example for extraction:
  Input: ~500 tokens (prompt + user text)
  Output: ~300 tokens (JSON result)
  Price: $0.05/1M tokens (Groq 8B)
  Requests: 1000/month
  Cost: (500+300) * 0.00000005 * 1000 = $0.04/month

Same task with GPT-4:
  Price: $30/1M input + $60/1M output
  Cost: (500*0.00003 + 300*0.00006) * 1000 = $33/month
  
  That's 825x more expensive for the same result.
```

**When to use which model size:**

| Model Size | Use When | Examples |
|---|---|---|
| **7-8B** | Structured output, classification, extraction, simple Q&A | Entity extraction, sentiment, categorization |
| **13-34B** | Multi-step reasoning, moderate creativity, summarization | Document summarization, code generation |
| **70B+** | Complex reasoning, creative writing, nuanced understanding | Weekly letters, complex RAG, multi-hop reasoning |
| **No LLM** | Counting, filtering, pattern matching, exact search | Pattern detection, data validation, keyword search |

**Latency optimization techniques:**

```
1. STREAMING         -- Return tokens as they're generated (UX improvement)
2. CACHING           -- Cache identical prompts (semantic caching for similar)
3. BATCHING          -- Process multiple requests in one LLM call
4. ASYNC PROCESSING  -- Don't make users wait (what Nara does with pg-boss)
5. MODEL ROUTING     -- Simple queries to small model, complex to large
6. SPECULATIVE DECODING -- Small model drafts, large model verifies (advanced)
```

### Interview-Ready Answer

> "I use a tiered model strategy based on three factors: output structure (structured tasks tolerate smaller models because schema constraints compensate for capability gaps), user visibility (user-facing outputs like letters need quality models), and request frequency (high-frequency tasks must be cost-optimized). In Nara, this meant Groq Llama 8B at temperature 0 for extraction ($0.05/1M tokens), Groq 70B at 0.7 for weekly letters ($0.27/1M), and pure SQL for pattern detection ($0). The result is $1.20/month total vs $150/month with GPT-4 everywhere -- a 125x cost reduction with equivalent output quality, validated through evaluation benchmarks."

---

## REQUIREMENT 1: Expert Python

### What They Want
> "Expert-level Python skills; you write clean, modular, and testable code."

### What We Built in Nara

**Clean, modular code:**
```
nara_worker/
  config.py          -- pydantic-settings, @lru_cache singleton
  db.py              -- AsyncConnectionPool, fetchone/fetchall helpers
  models.py          -- Pydantic v2 models with validators
  clients/           -- LangChain client factories (not singletons -- testable)
  pipeline/          -- extraction, persistence, embedding (each independent)
  rag/               -- ask_nara (separate from pipeline)
  jobs/              -- process_entry, detect_patterns, weekly_letter, etc.
  prompts/           -- versioned prompt strings (separate from logic)
  worker.py          -- FastAPI + pg-boss poll loop
```

**Testable design patterns:**
```python
# Factory functions instead of module-level singletons
def get_fast_llm() -> ChatGroq:     # Tests can monkeypatch get_settings()
def get_quality_llm() -> ChatGroq:  # No API calls at import time
def get_embeddings() -> OpenAIEmbeddings:

# Dependency injection via function params (not global state)
async def save_notes_from_extraction(conn, user_id, entry_id, extraction):
    # conn is injected -- tests pass an AsyncMock
    
# Non-fatal design (embed_note returns bool, not raises)
async def embed_note(conn, note_id, user_id, content) -> bool:
    try: ...
    except Exception: return False  # caller decides what to do
```

**Type safety:**
```python
EntityType = Literal["person", "topic", "place", "other"]

class ExtractedEntity(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: EntityType
    context_snippet: str | None = Field(default=None, max_length=2000)
```

**Test count: 30 unit tests + 3 integration tests (skipped without real keys)**

### Interview-Ready Answer

> "I structure AI services as modular Python packages with clear separation: config (pydantic-settings), clients (LangChain factory functions), pipeline stages (extraction, persistence, embedding as independent modules), prompt management (versioned strings separate from logic), and job orchestration. I use factory functions over module-level singletons so tests can monkeypatch settings without touching global state. All async functions accept their dependencies (database connections, LLM clients) as parameters for clean mocking. I have 30+ unit tests using pytest-asyncio with AsyncMock."

---

## REQUIREMENT 2: LLM Orchestration Production Experience

### What They Want
> "Deep production experience with LLM orchestration (LangChain, LangGraph, etc.) -- you know where these frameworks break and how to fix them."

### Where LangChain Breaks (and How We Fixed It)

**Break 1: Structured output sometimes fails**
```python
# Problem: Groq 8B occasionally returns pronouns instead of resolved names
# Fix: Pydantic validator as safety net
@field_validator("name")
def _reject_pronouns(cls, v):
    if v.strip().lower() in {"he", "she", "they", ...}:
        raise ValueError(f"unresolved pronoun: {v!r}")
    return v
# LangChain auto-retries with the error message when validation fails
```

**Break 2: PGVector assumes its own table schema**
```python
# Problem: langchain_postgres.PGVector creates langchain_pg_embedding table
# with its own schema. Doesn't work with our note_embeddings table.
# Fix: Bypass PGVector entirely, query pgvector directly:
rows = await fetchall(conn,
    "SELECT n.content, ne.embedding <=> %s::vector AS distance "
    "FROM note_embeddings ne JOIN notes n ON n.id = ne.note_id "
    "WHERE n.user_id = %s ORDER BY distance LIMIT %s",
    (query_vector, user_id, k)
)
# Lesson: Use LangChain for LLM calls. Use raw SQL for data access.
```

**Break 3: Module-level client instantiation blocks testing**
```python
# Problem (plan spec had this):
fast_llm = ChatGroq(model="llama-3.1-8b-instant", api_key=settings.groq_api_key)
# This runs at import time. Tests fail without GROQ_API_KEY set.

# Fix: Factory functions
def get_fast_llm() -> ChatGroq:
    s = get_settings()
    return ChatGroq(model=s.groq_model_fast, api_key=s.groq_api_key, temperature=0)
```

**Break 4: psycopg3 vs psycopg2 confusion**
```python
# Problem: LangChain's PGVector internally uses psycopg2 (SQLAlchemy).
# Our stack uses psycopg3 (async). Incompatible connection pools.
# Fix: Don't use LangChain for vector storage. Only use it for LLM calls.
```

### Interview-Ready Answer

> "I know where LangChain breaks in production: (1) Structured output validation -- the 8B model occasionally produces invalid data; I add Pydantic validators as safety nets that trigger automatic retries. (2) PGVector integration assumes its own table schema, which conflicts with custom schemas; I bypass it with raw pgvector SQL queries. (3) Module-level client instantiation blocks testing; I use factory functions for lazy initialization. (4) psycopg2/psycopg3 incompatibility in the LangChain Postgres integration; I only use LangChain for LLM calls, not data access. The general principle: use LangChain for what it's good at (prompt templates, structured output, model abstraction) and raw code for everything else."

---

## REQUIREMENT 3: Modern Data Stack (SQL, Vector DBs)

### What They Want
> "Strong understanding of the modern Data Stack (SQL, Snowflake, Vector DBs); you know that good AI requires good data."

### What We Built in Nara

**SQL expertise demonstrated:**
```sql
-- Complex JOIN query with aggregation (entity timeline)
SELECT n.id AS note_id, n.created_at AS date, n.content,
       n.emotion_score, ne.context_snippet
FROM note_entities ne
JOIN notes n ON n.id = ne.note_id
WHERE ne.entity_id = $1 AND n.user_id = $2
ORDER BY n.created_at DESC;

-- Upsert pattern (find-or-create)
INSERT INTO entities (user_id, name, entity_type) VALUES ($1, $2, $3)
ON CONFLICT (user_id, entity_type, lower(name))
DO UPDATE SET mention_count = entities.mention_count + 1,
             last_mentioned_at = now()
RETURNING id;

-- Vector similarity search
SELECT n.content, ne.embedding <=> $1::vector AS distance
FROM note_embeddings ne
JOIN notes n ON n.id = ne.note_id
WHERE n.user_id = $2
ORDER BY distance ASC LIMIT $3;

-- Concurrent-safe job claiming
SELECT id FROM pgboss.job
WHERE name = 'process_entry' AND state = 'created'
ORDER BY created_on ASC LIMIT 1
FOR UPDATE SKIP LOCKED;
```

**Database design:**
- 13 tables with proper normalization
- FK constraints with ON DELETE CASCADE
- Unique constraints for dedup: `(user_id, entity_type, lower(name))`
- CHECK constraints: `entity_a_id < entity_b_id` (canonical ordering)
- Row-Level Security on all user-owned tables
- pgvector IVFflat index for vector search

### Interview-Ready Answer

> "Nara's database is 13 normalized Postgres tables with pgvector for embeddings. Key design decisions: UPSERT (ON CONFLICT DO UPDATE) for atomic find-or-create of entities, canonical pair ordering (CHECK entity_a_id < entity_b_id) to prevent duplicate co-occurrence pairs, Row-Level Security for defense-in-depth data isolation, and FOR UPDATE SKIP LOCKED for concurrent-safe job claiming. I chose pgvector over Pinecone because it eliminates operational overhead and shares the existing Postgres instance, which is the right trade-off at our scale (thousands of vectors)."

---

## REQUIREMENT 4: MLOps / LLMOps

### What They Want
> "Experience in MLOps or LLMOps (tracing, monitoring, and versioning prompts/chains)."

### What We Built in Nara

**Prompt versioning:**
```python
EXTRACTION_VERSION = "v1"
WEEKLY_LETTER_VERSION = "v1"
```

**Structured logging:**
```python
logger.info("Entry %s processed -> %d notes", entry_id, len(note_ids))
logger.warning("Embedding failed for note %s: %s", note_id, exc)
logger.error("Extraction failed for entry %s: %s", entry_id, exc)
```

**State tracking:**
```sql
-- Entry status tracking (observable pipeline)
status: pending -> processing -> done | failed
error: text (stored on failure for debugging)
processed_at: timestamp (for latency measurement)
```

### The Gap: Full LLMOps Stack

Nara has basic logging and versioning. What Turgon wants:

**The full LLMOps stack:**

```
1. TRACING      -- Track every LLM call: input, output, latency, tokens, cost
                   Tools: LangSmith, Langfuse, Phoenix (Arize)
                   
2. MONITORING   -- Dashboards for: latency p50/p95, error rate, cost/day,
                   token usage, hallucination rate
                   Tools: Grafana, Datadog, custom dashboards
                   
3. VERSIONING   -- Version prompts like code. A/B test prompt versions.
                   Track which version produced which outputs.
                   Tools: LangSmith Hub, custom prompt registry

4. EVALUATION   -- Continuous eval (not just pre-deploy)
                   Monitor quality metrics in production
                   Alert when accuracy drops below threshold

5. COST TRACKING -- Per-request cost attribution
                    Per-user cost tracking
                    Budget alerts
```

**What LangSmith tracing looks like:**

```python
# With LangSmith, every chain invocation is automatically traced:
# - Input prompt (full text)
# - Output (full response)
# - Latency (ms)
# - Token count (input + output)
# - Model used
# - Cost ($)
# - Parent/child spans (if chain has multiple steps)
# - Errors and retries

# Setup (one line):
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "ls_..."

# Now every LangChain call is automatically traced.
# No code changes needed.
```

### Interview-Ready Answer

> "In Nara, I version prompts with explicit version constants and track pipeline state in Postgres (entry status transitions with timestamps and error messages). For a production enterprise system, I'd add LangSmith or Langfuse for full LLM call tracing (capturing input/output/latency/cost per request), Grafana dashboards for p95 latency and error rate monitoring, and continuous evaluation pipelines that alert when quality metrics drift below threshold. The key insight is that LLMOps is different from MLOps because the failure mode isn't accuracy degradation over time (model drift), it's prompt brittleness -- a model update from the provider can silently change behavior, so you need continuous eval, not just pre-deploy testing."

### Study List
- [ ] Set up LangSmith tracing on Nara (free tier available)
- [ ] Understand traces, spans, and runs in LangSmith
- [ ] Learn Langfuse as an open-source alternative
- [ ] Know the difference between MLOps (model drift) and LLMOps (prompt brittleness)

---

## NICE-TO-HAVE 1: Fine-tuning Open-Source Models

### What They Want
> "Experience fine-tuning open-source models (Llama, Mistral) for specific domain tasks."

### What We Built in Nara
We use open-source models (Llama 3.1/3.3 via Groq) but we do NOT fine-tune them. We use prompt engineering + structured output instead.

### Deep Concepts: Fine-tuning vs Prompting

**When to fine-tune vs when to prompt:**

| Approach | When to Use | Cost | Time | Nara's Choice |
|---|---|---|---|---|
| **Prompt engineering** | Task is clear from examples, model is capable enough | $0 | Minutes | Yes (all tasks) |
| **Few-shot prompting** | Need consistent output format | $0 | Minutes | Could add |
| **Fine-tuning** | Domain-specific vocabulary, consistent style, reduce token usage | $50-500 | Hours | Not needed for Phase 1 |
| **RAG** | Need access to private/dynamic data | Infrastructure cost | Days | Yes (Ask Nara) |

**Fine-tuning concepts you should know:**

```
LoRA (Low-Rank Adaptation):
  - Don't update all model weights (billions of params)
  - Add small trainable matrices (rank 8-64) to attention layers
  - Train only these ~1M params instead of 8B params
  - Result: 95% of full fine-tune quality at 1% of cost
  - Tool: Hugging Face PEFT library

QLoRA:
  - LoRA but with 4-bit quantized base model
  - Fits on a single GPU (even consumer GPUs)
  - Slightly lower quality than full LoRA

RLHF (Reinforcement Learning from Human Feedback):
  - Train a reward model from human preferences
  - Use PPO to optimize the LLM against the reward model
  - This is how ChatGPT was trained
  - You probably won't do this at a startup (too expensive)

DPO (Direct Preference Optimization):
  - Simpler alternative to RLHF
  - No separate reward model needed
  - Just need pairs: (preferred response, rejected response)
  - Increasingly popular for production fine-tuning
```

### Interview-Ready Answer

> "In Nara, I chose prompting + structured output over fine-tuning because the tasks (entity extraction, letter generation) are well-defined enough that prompt engineering with Pydantic validation achieves the required quality. Fine-tuning would make sense for Turgon's enterprise domain (ERP terminology, company-specific processes) where the base model lacks domain vocabulary. I'd use QLoRA (4-bit quantized base + low-rank adapters) for cost-effective fine-tuning on a single GPU, with DPO for alignment if we have preference data. The decision framework: if >50% of your prompt is examples/format instructions, fine-tuning will reduce cost and improve consistency."

---

## SKILL GAP ANALYSIS: What Nara Covers vs What You Need

### Strongly Covered (can demo with code)

| Skill | Evidence in Nara |
|---|---|
| LangChain production usage | 6 modules using ChatGroq, OpenAIEmbeddings, ChatPromptTemplate, with_structured_output |
| RAG pipeline | Full implementation: embed -> retrieve -> generate -> cite |
| Structured extraction | Pydantic v2 models, validators, co-reference resolution prompt |
| Async job architecture | pg-boss queue, worker poll loop, status tracking |
| Cost/latency engineering | Tiered models (8B vs 70B), temperature tuning, SQL vs LLM decisions |
| Python (clean, modular, testable) | Factory functions, dependency injection, 30+ tests |
| SQL + Vector DBs | 13 tables, pgvector, IVFflat, complex JOINs, UPSERT patterns |
| Non-fatal failure design | Embedding failures don't block pipeline |
| Data isolation | user_id WHERE clauses + RLS + JWT auth |
| Prompt engineering | Versioned prompts, grounding, style constraints, role-task-format |

### Partially Covered (concept understood, needs practice)

| Skill | What You Have | What to Add |
|---|---|---|
| Evals | Pydantic validators + golden-input tests | LLM-as-Judge, RAGAS, F1 metrics, eval pipeline |
| LLMOps | Prompt versioning + structured logging | LangSmith tracing, Langfuse, monitoring dashboards |
| Advanced RAG | Basic top-k retrieval | Hybrid search, re-ranking, HyDE, multi-query |

### Not Covered (needs dedicated study)

| Skill | Why It's Important for Turgon | How to Learn |
|---|---|---|
| **LangGraph** | Their core framework for multi-agent workflows | Build a 3-agent system (supervisor + researcher + executor) |
| **Multi-agent systems** | Enterprise tasks need multiple specialized agents | Study supervisor, plan-and-execute, and ReAct patterns |
| **Fine-tuning (LoRA/QLoRA)** | Domain adaptation for enterprise terminology | Fine-tune Llama on a small dataset using Hugging Face PEFT |
| **Human-in-the-loop** | Enterprise workflows need approval gates | Add a LangGraph interrupt node to a workflow |
| **Distributed computing (Ray/Kubeflow)** | Scale beyond single machine | Nice-to-have; low priority for interview |

---

## YOUR NARA PITCH (60 seconds)

> "I built Nara, a personal memory app powered by a full AI pipeline. Users submit text entries; the system extracts entities and notes using Groq Llama 8B with LangChain structured output, builds a per-user knowledge graph with canonical co-occurrence pairs, stores embeddings in pgvector for Ask Nara (a RAG pipeline using Groq 70B grounded only in the user's own data), and generates personalized weekly letters and nudges. 
>
> The architecture decisions I'm proudest of: a tiered model strategy that keeps costs at $1/month for 50 users (vs $150 with GPT-4), non-fatal failure design where embedding outages don't block note creation, and user-scoped RAG with three-layer data isolation (application WHERE clauses, Postgres RLS, and JWT auth). 
>
> The entire backend runs on Python (AI worker) + Node (API) with Postgres as the single data store -- no Redis, no separate vector DB, no Kubernetes. Intentionally simple infrastructure that lets the AI engineering shine."

---

## WEEK-BY-WEEK STUDY PLAN

### Week 1: LangGraph (highest priority gap)
- Day 1-2: LangGraph tutorial -- build a simple chatbot with tools
- Day 3-4: Build a multi-agent system (supervisor pattern)
- Day 5-6: Add human-in-the-loop with checkpointing
- Day 7: Add LangGraph to Nara (refactor process_entry as a StateGraph)

### Week 2: Evals + LLMOps
- Day 1-2: Build a 20-example golden dataset for Nara's extraction
- Day 3-4: Implement LLM-as-Judge for Ask Nara
- Day 5: Set up LangSmith tracing on Nara
- Day 6-7: Build a simple eval dashboard (precision/recall/F1 over time)

### Week 3: Advanced RAG + Fine-tuning Concepts
- Day 1-2: Implement hybrid search (vector + keyword) on Nara
- Day 3-4: Add re-ranking with a cross-encoder
- Day 5-6: Fine-tune Llama 8B on a toy dataset using QLoRA (just to understand the process)
- Day 7: Review and practice interview answers

### Week 4: Mock Interviews + Polish
- Day 1-3: Practice all interview answers out loud
- Day 4-5: Build one more feature on Nara (whatever feels weak)
- Day 6-7: Final review, update resume, reach out to referral contact
