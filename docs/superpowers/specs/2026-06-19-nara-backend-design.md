# Nara Backend — Design Spec (Phase 1)

**Date:** 2026-06-19
**Status:** Approved (brainstorming → planning)

## Summary
Build the AI backend for Nara, a voice-first personal memory app, for a closed beta
of 20–50 users at ~$40–55/mo. **Phase 1 takes text input** (no audio yet) and proves
the AI brain: entity extraction → multiple notes → entity graph → embeddings → Ask
Nara → loose ends → pattern detection → weekly letters → nudges.

## Decisions (full detail in docs/ARCHITECTURE.md + ADRs)
- **Persistence:** Supabase (Postgres + pgvector + Auth + Storage). [ADR-001]
- **AI models:** Groq `llama-3.1-8b-instant` (extraction), `llama-3.3-70b-versatile`
  (letters, Ask Nara); OpenAI `text-embedding-3-small` (embeddings); Groq Whisper
  (Phase 2). [ADR-002]
- **Services:** Node/Fastify API + Python/FastAPI AI worker, integrated via pg-boss
  queue in Postgres. [ADR-003]
- **Frontend (Phase 3):** React Native + Expo, Expo Router, Zustand + TanStack Query.
- **Hosting:** Railway (services) + Supabase (data) + EAS (mobile).

## Scope — Phase 1 (this build)
In: auth, `POST /entries` (text), async pipeline, notes/categories/entities/
co-occurrences, embeddings, Ask Nara (RAG), loose ends, pattern detection, weekly
letter generation, nudge generation, mood observations. All ten REST endpoint groups
in API_CONTRACT.md.
Out (later phases): audio upload + Whisper + Storage (P2); the mobile app + Expo Push
delivery (P3).

## Success criteria
1. One text entry produces multiple correctly categorized notes (Rule #1).
2. Entity graph builds without duplicates or double-counted co-occurrences (Risk #1).
3. Ask Nara answers are grounded only in the user's notes (Rule #9).
4. Weekly letter reads warm and specific, never generic, no bullet lists (Rule #5).
5. No pattern surfaced under 3 data points (Rule #3). No raw scores exposed (Rule #8).
6. Account deletion removes all data, no orphans (Rule #10). RLS blocks cross-user
   access (Rule #6).

## Governing behavioral rules
The 10 rules from the kickoff appendix apply verbatim; mirrored in CLAUDE_BACKEND.md.

## Build order
Scaffold → migrations (schema) → shared types → extraction pipeline → entity registry
→ embeddings → API CRUD → Ask Nara → loose ends → scheduled jobs (patterns, letters,
nudges). Detailed dependency-ordered plan lives in the implementation plan + CLAUDE.md.
