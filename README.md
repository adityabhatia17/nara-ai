# Nara

**A brain you can talk to.** Nara is a text-first personal memory app: you write freely, and an AI pipeline turns each entry into organized notes, builds a private knowledge graph of the people and topics in your life, answers questions grounded only in your own notes, and writes you a warm weekly letter.

This repository is a full, working implementation — a Node API, a Python AI worker, a React Native app, and a Postgres/pgvector data layer — built to production patterns.

> **Status:** Phase 1 (text input) complete and end-to-end verified. Closed-beta scale (~20–50 users).

---

## What it does

| Capability | How it works |
|---|---|
| **Entry → many notes** | One free-text entry is split into atomic notes via an LLM with structured (schema-constrained) output. |
| **Entity graph** | People, topics, and places are extracted, de-duplicated (find-or-create), and linked by co-occurrence — a per-user knowledge graph. |
| **Ask Nara (RAG)** | Natural-language questions answered by retrieval-augmented generation over *your* notes only — never fabricated. |
| **Patterns** | Recurring co-occurrences surfaced via SQL (never below 3 data points). |
| **Weekly letter** | A warm, grounded letter generated from the week's notes — no lists, no templates. |
| **Nudges** | Gentle, specific reminders (loose ends, inactivity) with quiet-hours and rate limits. |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Mobile app │────▶│  Node/Fastify API │────▶│  pg-boss (Postgres) │
│  (Expo RN)  │◀────│   REST · :3000    │     │      job queue      │
└─────────────┘     └──────────────────┘     └─────────┬──────────┘
                              │                          │ polls
                              ▼                          ▼
                    ┌──────────────────┐     ┌────────────────────┐
                    │ Supabase Postgres │◀────│ Python AI worker    │
                    │ + pgvector + RLS  │     │ FastAPI · :8000     │
                    └──────────────────┘     │ LangChain pipeline  │
                                             └────────────────────┘
```

**Design decisions that matter:**

- **Tiered models for cost/quality** — Groq Llama **8B** for high-frequency extraction, **70B** for quality-critical letters and RAG, OpenAI `text-embedding-3-small` for embeddings. ~$1/mo at beta scale vs ~$150 with a single large model.
- **One data store** — Supabase Postgres holds relational data, vector embeddings (pgvector), auth, and the job queue (pg-boss). No Redis, no separate vector DB, no Kubernetes.
- **Per-user isolation, defense in depth** — every query is scoped by `user_id`, backed by Postgres Row-Level Security and JWT auth.
- **Async by default** — entries are processed off the request path via a queue; the client polls for completion.
- **Non-fatal failure design** — an embedding outage never blocks note creation; a sweeper re-queues stuck work.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md), and the ADRs in [`docs/DECISIONS/`](docs/DECISIONS/) for the full reasoning.

---

## Tech stack

| Layer | Stack |
|---|---|
| **Mobile** | React Native + Expo (SDK 56), Expo Router, TanStack Query, Zustand, TenTap editor |
| **API** | Node 20, Fastify 5, TypeScript (ESM), Zod, pg-boss |
| **AI worker** | Python 3.12, FastAPI, **LangChain** (Groq + OpenAI + pgvector), psycopg3 |
| **Data / platform** | Supabase (Postgres + pgvector + Auth + RLS) |
| **Models** | Groq Llama 3.1-8B / 3.3-70B · OpenAI text-embedding-3-small |

---

## Repository layout

```
apps/
  api/         Node/Fastify REST API (auth, notes, entities, ask, …) + SQL migrations
  ai-worker/   Python LangChain pipeline (extraction, embeddings, RAG, jobs)
  mobile/      React Native + Expo app
packages/
  shared/      Shared TypeScript types (the API contract)
docs/          Architecture, DB schema, API contract, ADRs
```

---

## Running locally

You'll need: Node 20 + pnpm, Python 3.12 + [uv](https://github.com/astral-sh/uv), a Supabase project, and Groq + OpenAI API keys.

```bash
# 1. Install JS deps
pnpm install

# 2. Configure secrets (copy the examples, fill in your own keys)
cp .env.example apps/api/.env
cp apps/ai-worker/.env.example apps/ai-worker/.env
# set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY for apps/mobile

# 3. Run database migrations
cd apps/api && pnpm db:migrate

# 4. Start the API (:3000)
pnpm dev

# 5. Start the AI worker (:8000)
cd ../ai-worker && uv sync && uv run uvicorn nara_worker.worker:app --port 8000

# 6. Start the mobile app
cd ../mobile && pnpm start
```

> **Secrets:** every `.env` is git-ignored. Only `*.env.example` files (placeholders) are committed. Never commit real keys.

---

## Engineering notes

- **Structured extraction** uses LangChain `with_structured_output(PydanticModel)` with validators (e.g. rejecting unresolved pronouns) as a safety net for the smaller model.
- **RAG grounding** is enforced in the prompt ("answer only from these notes") and by scoping retrieval to the user before any context reaches the model.
- **The entity graph** maintains a canonical co-occurrence invariant (`entity_a_id < entity_b_id`) and atomic find-or-create via `INSERT … ON CONFLICT DO UPDATE`.
- **Edits stay consistent** — editing or appending to a note re-enqueues embedding so RAG never quotes stale text.

---

## License

MIT — see [`LICENSE`](LICENSE).
