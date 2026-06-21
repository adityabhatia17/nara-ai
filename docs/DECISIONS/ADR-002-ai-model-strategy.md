# ADR-002: Tiered open-weight AI models via Groq, with OpenAI embeddings

## Status: Accepted (2026-06-19)

## Context
Nara has four distinct AI tasks with very different frequency and quality profiles:
1. **Entity extraction** — runs on every entry, high frequency, structured output.
2. **Ask Nara synthesis** — on demand, must read across notes and sound human.
3. **Weekly letter** — once per user per week, the emotional core, highest quality bar.
4. **Embeddings** — on every note, must be cheap and good for retrieval.

Constraints: ~$50–100/mo budget, preference for open-source models, and a goal of
growing the user's practical AI engineering skills.

## Decision
- **Inference via Groq**, tiered by task:
  - Entity extraction → **`llama-3.1-8b-instant`** (cheap, fast, JSON mode).
  - Ask Nara + weekly letter → **`llama-3.3-70b-versatile`** (quality).
- **Embeddings via OpenAI `text-embedding-3-small`** (1536-dim), behind an interface
  so it can be swapped for a self-hosted model later.
- **Transcription via Groq Whisper** (`whisper-large-v3-turbo`) — Phase 2 only.

## Alternatives Considered
- **One model for everything (e.g. 70B for all):** rejected. Overpays on the
  highest-frequency task (extraction) for quality extraction doesn't need.
- **One model for everything (e.g. 8B for all):** rejected. The weekly letter and
  Ask Nara need genuine synthesis quality; an 8B model produces generic letters,
  which is the single biggest trust risk (Risk #3).
- **GPT-4o / Claude for everything:** rejected as default. Excellent but premium
  per-token pricing and closed-weight, against the open-source preference. We keep
  one pragmatic closed dependency (embeddings) only because Groq has no embeddings
  endpoint and `3-small` is effectively free.
- **Self-hosted Llama + self-hosted embeddings:** rejected for now. Always-on GPU
  cost and ops outweigh benefit at 20–50 users. The interface boundary keeps this
  open as a future option.

## Consequences
- Costs stay ~$5–15/mo for inference + <$1/mo embeddings — well inside budget.
- Two AI providers (Groq, OpenAI) instead of one; acceptable, and both are behind
  thin client wrappers in the Python worker.
- Prompts become first-class versioned, tested assets (golden-input tests for
  extraction; reviewed prompt for the letter). Model choice is necessary but not
  sufficient — prompt quality carries the product.
- Swapping models later is a config + prompt-retune change, not an architectural one.
