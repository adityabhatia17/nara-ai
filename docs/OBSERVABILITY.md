# Observability: AI cost + behavior

Every LLM and embedding call writes one row to the **`ai_events`** table. We compute cost
ourselves from a static price map, so this is $0 and fully private (token counts only,
never note content).

## How it works
- **Chat calls** (extraction, ask, letter): a LangChain callback (`telemetry/callback.py`)
  reads token usage on `on_llm_end`, prices it, and writes the row. Pipeline code is
  unchanged; callers just pass `config=telemetry_config(operation, user_id)`.
- **Embeddings**: recorded directly in `embed_note` (the embeddings endpoint returns no
  token usage, so tokens are estimated from text length; cost is negligible).
- Prices live in `telemetry/pricing.py` (USD per 1M tokens). Update there on price changes.

## Useful queries
```sql
-- cost + p95 latency per operation, last 30 days
SELECT operation, COUNT(*) calls, ROUND(SUM(cost_usd),4) usd,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) p95_ms
FROM ai_events WHERE created_at > now() - interval '30 days' GROUP BY 1;

-- spend per user
SELECT user_id, ROUND(SUM(cost_usd),4) usd FROM ai_events GROUP BY 1 ORDER BY 2 DESC;

-- daily spend
SELECT date_trunc('day', created_at) d, ROUND(SUM(cost_usd),4) usd
FROM ai_events GROUP BY 1 ORDER BY 1;

-- failures
SELECT operation, model, error FROM ai_events WHERE NOT success ORDER BY created_at DESC;
```

## LangSmith (dev-only debugging, optional, off by default)
For deep prompt/response trace inspection while developing, set these two env vars on your
machine only, then run the worker. Every chain auto-traces to LangSmith. Turn them off for
normal runs so production traffic never sends note content to a third party.
```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=ls-...   # your personal LangSmith key
```
Cost tracking does not depend on this; `ai_events` is the source of truth.
