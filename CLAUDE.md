# NARA — Principal Architect Context

> Loaded at the start of every session to restore full context. Update before ending
> any session.

## Project overview
Nara is a voice-first personal memory app ("a brain you can talk to"). User talks
freely; Nara extracts entities, splits into organized notes, builds a per-user entity
graph, detects patterns, and produces warm weekly letters + specific nudges. Closed
beta, 20–50 users, ~$40–55/mo. Product feel: warm, calm, literary. See
`nara-product-vision.md` (source brief, in user's Downloads).

Three-agent model: **Architect (me)** owns decisions + docs + backend core;
**Backend Agent** (`docs/CLAUDE_BACKEND.md`); **Frontend Agent**
(`docs/CLAUDE_FRONTEND.md`). Golden rule: nothing built before designed; every
decision has a documented home.

## Current focus
Phase 1 backend = the AI brain on **text input** (no audio). Planning docs complete;
next is scaffolding the two apps and implementing the pipeline.

## Last session summary (2026-06-19)
- Ran full brainstorming with the user; locked all tech decisions.
- Wrote ARCHITECTURE.md, DATABASE_SCHEMA.md (13 tables), API_CONTRACT.md (frozen),
  ADR-001/002/003, CLAUDE_BACKEND.md, CLAUDE_FRONTEND.md, this file, the spec.
- Created monorepo skeleton (pnpm workspace, .gitignore, .env.example).
- Key user-driven decisions: open-source models preferred; Python for AI + TS/Node
  for API; Supabase; **Phase 1 is text-only (Whisper deferred to Phase 2)**.

## Architecture decisions log
- 2026-06-19 — Supabase (Postgres+pgvector+Auth+Storage) as single platform. *Fewest
  services, RLS = free per-user isolation, relational fits the entity graph.* [ADR-001]
- 2026-06-19 — Tiered Groq Llama models (8B extract / 70B letter+ask) + OpenAI
  3-small embeddings. *Match model cost to task frequency; open-weight; cheap.* [ADR-002]
- 2026-06-19 — Node API + Python worker via pg-boss in Postgres. *Best ecosystem per
  side; zero new infra for the queue; crash-resilient.* [ADR-003]
- 2026-06-19 — REST (not tRPC/GraphQL); pnpm workspaces; Expo Router; Zustand +
  TanStack Query; Railway + Supabase + EAS hosting. [ARCHITECTURE.md §2]
- 2026-06-19 — **Phase 1 text-only** (user decision). Whisper/Storage/audio = Phase 2;
  mobile app + push = Phase 3.

## Implementation state
### Done
- All planning/contract docs + ADRs.
- Monorepo skeleton + root config (package.json, pnpm-workspace.yaml, .gitignore,
  .env.example).
### In progress
- Backend scaffolding (next action).
### Queued (dependency order)
1. Scaffold `apps/api` (Fastify+TS+Zod+Supabase+pg-boss producer).
2. Scaffold `apps/ai-worker` (uv+FastAPI+worker loop+Groq/OpenAI clients).
3. `packages/shared` TS types from API_CONTRACT.
4. SQL migrations (13 tables + indexes + RLS + pgvector/pgcrypto extensions).
5. Extraction prompt + pipeline + persistence (entity registry, co-occurrence).
6. Embeddings → note_embeddings.
7. API CRUD (auth, entries, notes, categories, entities, loose-ends).
8. Ask Nara (RAG).
9. Scheduled jobs (detect_patterns, weekly_letter, evaluate_nudges, sweeper).
10. mood + notifications/preferences + DELETE /account.
Then Phase 2 (audio), then Phase 3 (mobile).

## Open technical questions
- **Entity aliases** ("Mom"/"my mother" → one entity). Phase 1: extractor normalizes
  to canonical name. Planned fix: `entity_aliases` table. Current thinking: add when
  duplicate-alias pain shows up in real beta data.
- **ivfflat lists=100** — fine for beta; move to hnsw if recall/latency suffers.
- **emotion_score** single-axis for now; multi-axis (valence/arousal) is an additive
  future option.
- **Ask Nara location** — served by Node API calling worker sync, or worker endpoint?
  Leaning: Node API owns the RAG orchestration (it already has the Supabase client),
  calling Groq/OpenAI directly via a small TS client, to avoid a sync hop. Revisit
  during step 8.

## Critical reminders
- **emotion_score never crosses the API boundary** (Rule #8).
- **Entity find-or-create** on `(user_id, type, lower(name))`; **co-occurrence**
  canonical `a_id < b_id` — these two invariants protect the crown-jewel graph (Risk #1).
- **Pipeline idempotent on entry_id**; embedding failure non-fatal.
- **Weekly letter: no lists/bullets/templates**, grounded in real notes (Rule #5).
- API_CONTRACT.md is frozen — changes require a changelog entry.
- Update this file + the relevant CLAUDE_*.md before ending a session.

## Key documents
- `docs/ARCHITECTURE.md` — every tech decision + topology + pipeline + risks.
- `docs/DATABASE_SCHEMA.md` — 13 tables, indexes, RLS, deletion rules.
- `docs/API_CONTRACT.md` — frozen endpoint contract.
- `docs/DECISIONS/ADR-001..003` — the consequential choices.
- `docs/CLAUDE_BACKEND.md` / `docs/CLAUDE_FRONTEND.md` — agent briefings.
- `docs/superpowers/specs/2026-06-19-nara-backend-design.md` — approved spec.
