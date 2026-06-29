# NARA — Principal Architect Context

> Loaded at the start of every session to restore full context. Update before ending
> any session.

## Project overview
Nara is a text-based personal memory app ("a brain you can talk to"). User types
freely; Nara extracts entities, splits into organized notes, builds a per-user entity
graph, detects patterns, and produces warm weekly letters + specific nudges. Phase 1
is text-only (audio is an unplanned future option). Closed beta, 20-50 users,
~$40-55/mo. Product feel: warm, calm, literary.

Three-agent model: **Architect (me)** owns decisions + docs + backend core;
**Backend Agent** (`docs/CLAUDE_BACKEND.md`); **Frontend Agent**
(`docs/CLAUDE_FRONTEND.md`). Golden rule: nothing built before designed; every
decision has a documented home.

## Current focus
Backend + mobile app are built and running. Current work is UX polish and
release-readiness for text-only Phase 1.

## Last session summaries
### 2026-06-28
- Backend complete and E2E verified: Node/Fastify API (apps/api, port 3000) + Python
  AI worker (apps/ai-worker, port 8000). All 12 REST route groups, full extraction
  pipeline (Groq 8B), embeddings (OpenAI), Ask Nara RAG (Groq 70B), patterns, weekly
  letters, nudges, sweeper.
- Supabase live: all migrations run (13 tables + pgvector + RLS), real keys in .env.
- Mobile app built (apps/mobile): React Native + Expo SDK 56, 10+ screens, TenTap
  rich-text editor, text-only (voice/recording removed from Phase 1).
- Home redesigned: notes-list-first with floating action button (FAB) bottom-right
  (replaced the old central record/new-note hero).
- Note edit flow fixed: Edit (PUT /notes/:id) and "Add to note" (POST /notes/:id/append)
  now distinct.
- Login is email OTP-code (two-step: enter email → enter 6-digit code → verifyOtp),
  via Supabase Auth SDK. Stays in-app; no password, no Google config needed.

### 2026-06-19
- Brainstorming + all tech decisions locked.
- Wrote all planning docs (ARCHITECTURE, DATABASE_SCHEMA, API_CONTRACT, ADRs).
- Created monorepo skeleton.

## Architecture decisions log
- 2026-06-19 — Supabase (Postgres+pgvector+Auth+Storage) as single platform. *Fewest
  services, RLS = free per-user isolation, relational fits the entity graph.* [ADR-001]
- 2026-06-19 — Tiered Groq Llama models (8B extract / 70B letter+ask) + OpenAI
  3-small embeddings. *Match model cost to task frequency; open-weight; cheap.* [ADR-002]
- 2026-06-19 — Node API + Python worker via pg-boss in Postgres. *Best ecosystem per
  side; zero new infra for the queue; crash-resilient.* [ADR-003]
- 2026-06-19 — REST (not tRPC/GraphQL); pnpm workspaces; Expo Router; Zustand +
  TanStack Query; Railway + Supabase + EAS hosting. [ARCHITECTURE.md §2]
- 2026-06-19 — **Phase 1 text-only** (user decision). Audio/voice is an unplanned
  future option, not a committed phase.

## Implementation state
### Done
- All planning/contract docs + ADRs + monorepo skeleton.
- `apps/api` — Fastify + TS + Zod + Supabase + pg-boss producer. All 12 route groups.
- `apps/ai-worker` — Python pipeline: extraction (Groq 8B via LangChain), persistence
  (entity graph + co-occurrences), embeddings (OpenAI 3-small → pgvector), Ask Nara
  RAG (Groq 70B), pattern detection (SQL), weekly letters, nudges, sweeper.
- `packages/shared` TS types.
- SQL migrations (13 tables + indexes + RLS + pgvector/pgcrypto).
- Supabase configured and live (real keys, E2E verified).
- `apps/mobile` — React Native + Expo SDK 56, Expo Router, TanStack Query, Zustand,
  TenTap rich-text editor. 10+ screens built (Home, Feed, Note Detail, Editor, Ask,
  People, Person Detail, Nudges, Reveal, Settings, Login).
- Auth: email OTP-code (signInWithOtp → verifyOtp) via Supabase Auth SDK.
### Queued (release-readiness)
- Final UX polish pass.
- Push notifications (Expo Push).
- Production deployment (Railway + EAS).
- Beta invite flow.

## Open technical questions
- **Entity aliases** ("Mom"/"my mother" → one entity). Phase 1: extractor normalizes
  to canonical name. Planned fix: `entity_aliases` table. Current thinking: add when
  duplicate-alias pain shows up in real beta data.
- **ivfflat lists=100** — fine for beta; move to hnsw if recall/latency suffers.
- **emotion_score** single-axis for now; multi-axis (valence/arousal) is an additive
  future option.
- **Ask Nara location** — currently served by the Python worker (RAG endpoint).

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
