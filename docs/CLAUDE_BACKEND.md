# CLAUDE_BACKEND.md — Backend Agent Briefing

You are the **Backend Engineer** for Nara. You implement everything server-side. You
make **no architectural decisions** — those are fixed in `docs/ARCHITECTURE.md`,
`docs/DATABASE_SCHEMA.md`, `docs/API_CONTRACT.md`, and `docs/DECISIONS/`. You execute
against those contracts. If something is genuinely undecided, check `CLAUDE.md` (root)
Open Questions; if still unclear, make the smallest reasonable choice, document it,
and continue.

---

## 1. What Nara is
A voice-first personal memory app. The user (Priya, 24, busy professional, won't set
up systems, won't tag anything) talks freely; Nara turns it into organized notes,
builds a per-person/per-topic memory, detects patterns, and writes warm weekly
letters and specific nudges. **Phase 1 takes text input** — no audio yet. Read
`nara-product-vision.md` (in Downloads / attach to context) for the full feel; the
emotional bar is the weekly letter line: *"You had a better week than Monday morning
felt like you would."*

## 2. Tech stack (locked)
- **API:** Node 20, TypeScript, Fastify, Zod validation. Lives in `apps/api`.
- **AI worker:** Python 3.12, FastAPI, managed with `uv`. Lives in `apps/ai-worker`.
- **DB/Auth/Storage:** Supabase (Postgres 15 + pgvector + Auth + Storage).
- **Queue:** pg-boss (Postgres-backed) — Node produces, Python consumes.
- **AI:** Groq `llama-3.1-8b-instant` (extraction), `llama-3.3-70b-versatile`
  (letters/Ask Nara); OpenAI `text-embedding-3-small` (embeddings); Groq Whisper (P2).
- **Shared types:** `packages/shared` (TypeScript). Python mirrors these as pydantic.

## 3. Monorepo layout
```
nara/
├── apps/
│   ├── api/          # Fastify API (TS)
│   │   ├── src/
│   │   │   ├── routes/        # one file per resource group
│   │   │   ├── lib/           # supabase client, auth, pg-boss producer
│   │   │   ├── schemas/       # Zod request/response schemas
│   │   │   └── server.ts
│   │   └── migrations/        # SQL migrations (numbered)
│   └── ai-worker/    # Python AI pipeline
│       ├── nara_worker/
│       │   ├── pipeline/      # extraction, embedding, entity_registry, loose_ends
│       │   ├── jobs/          # scheduled: patterns, weekly_letter, nudges
│       │   ├── prompts/       # versioned prompt templates
│       │   ├── clients/       # groq, openai wrappers
│       │   ├── db.py          # psycopg/sqlalchemy access
│       │   └── worker.py      # pg-boss consumer loop + cron registration
│       └── pyproject.toml
├── packages/shared/  # TS types shared with frontend
├── scripts/          # dev.sh, migrate, seed
└── docs/
```

## 4. Local dev environment
```bash
# one-time
cp .env.example .env          # fill in Supabase + Groq + OpenAI keys
pnpm install                  # JS deps
cd apps/ai-worker && uv sync  # Python deps

# run everything
pnpm db:migrate               # apply SQL migrations to Supabase
scripts/dev.sh                # starts API (pnpm --filter @nara/api dev) + worker (uv run worker)
```
Default points at a Supabase **cloud dev project**. `supabase start` (local Docker)
is an optional offline path. Single entrypoint goal: `scripts/dev.sh`.

## 5. Database schema
Authoritative: `docs/DATABASE_SCHEMA.md`. 13 tables: entries, notes, categories,
note_categories, entities, note_entities, entity_cooccurrences, note_embeddings,
loose_ends, patterns, weekly_letters, nudges, notification_preferences. RLS on every
user-owned table (`user_id = auth.uid()`). **Migrations must match the schema doc
exactly.** Migration order: extensions (pgvector, pgcrypto) → tables → indexes → RLS
policies → pg-boss schema (pg-boss creates its own on init).

**Two invariants you must never break (Risk #1):**
1. Entities are find-or-create on `(user_id, entity_type, lower(name))`. Never insert
   a duplicate.
2. Co-occurrence rows enforce `entity_a_id < entity_b_id`. Always order the pair
   before upsert. Upsert: `ON CONFLICT DO UPDATE SET count = count + 1`.

## 6. API contract
Authoritative: `docs/API_CONTRACT.md`. Implement every endpoint there. Key rules:
JWT auth on all but `/auth/*` and `/health`; cursor pagination; **never serialize
`emotion_score`** (Rule #8); consistent error shape; rate limits on `/entries` and
`/ask`.

## 7. The AI pipeline (job: `process_entry`)
Triggered when `POST /entries` enqueues `process_entry { entry_id }`. Worker steps:
1. set `entries.status = processing`.
2. **(P2 only)** transcribe audio → text.
3. **Entity extraction** — Groq 8B, JSON mode, against the versioned prompt in
   `prompts/extraction.py`. Output schema:
   ```json
   {
     "notes": [ { "content": "...", "categories": ["Work"],
                  "emotion_score": -0.6,
                  "entities": [ {"name":"Rohan","type":"person",
                                 "context_snippet":"Rohan texted..."} ],
                  "intentions": ["Reply to Rohan"] } ]
   }
   ```
   Validate with pydantic. On invalid JSON, reprompt up to 2× with the error; then
   mark entry `failed`. Co-reference ("he"/"my boyfriend" → Rohan) is resolved
   *inside* this step so only canonical names leave it.
4. **Persist** in one transaction per note: notes row → categories (find-or-create,
   palette color) → note_categories → entities (find-or-create, ++mention_count,
   bump last_mentioned_at) → note_entities (with context_snippet) →
   entity_cooccurrences (all entity pairs in the note, canonical order, upsert ++count)
   → loose_ends (from intentions; resolve open ones if completion language detected).
5. **Embedding** — OpenAI 3-small per note → note_embeddings. Non-fatal on failure:
   notes still appear; re-queue embedding separately.
6. set `entries.status = done`, `processed_at = now()`.

Idempotent on `entry_id` so retries converge. A sweeper re-queues entries stuck in
`processing` past a timeout.

## 8. Background jobs (pg-boss cron)
| job | schedule | does |
|-----|----------|------|
| `process_entry` | on-demand | the pipeline above |
| `embed_note` | on-demand (retry) | re-embed a note whose embedding failed |
| `detect_patterns` | daily/user | recompute co-occurrence/emotional-arc/temporal/frequency patterns; write `patterns` rows only at ≥3 data points (Rule #3) |
| `weekly_letter` | Sunday eve/user tz | collect week → 70B letter (no lists, grounded) → weekly_letters row → (P3) push |
| `evaluate_nudges` | a few ×/day/user | apply nudge rules (below); write nudges; (P3) push |
| `stuck_entry_sweeper` | every few min | re-queue entries stuck in processing |

**Nudge rules:** types = inactivity (no notes 4+ days), loose_end (unresolved
intention), pattern (a ≥3-point co-occurrence), unresolved (check-in after an
emotionally significant mention), entity_silence (person silent past their normal
cadence). Constraints: ≤2/day, none in quiet hours (pref-defined, default 10pm–8am
local), 48h cooldown per type, **every nudge references real content** (must have a
`source_note_id` or `entity_id`) — Rule #4.

## 9. Ask Nara (RAG, served by the API or a sync worker call)
1. embed question (OpenAI 3-small). 2. PARALLEL: vector top-K (≈10) over
note_embeddings for this user + entity-graph lookup if question names a known entity.
3. merge/dedupe → context block. 4. Groq 70B with strict grounding system prompt
(answer ONLY from these notes; if none, say "I haven't heard you mention that yet";
never fabricate — Rule #9). 5. return `{ answer, cited_note_ids }`.

## 10. Prompts are versioned code
`apps/ai-worker/nara_worker/prompts/` holds: `extraction.py`, `weekly_letter.py`,
`ask_nara.py`. Each exports a system prompt + builder + version string. Extraction has
golden-input unit tests. The weekly-letter prompt forbids bullets/lists/templates and
requires grounding in specific notes (Rule #5) — it is reviewed, not just written.

## 11. The 15 governing behavioral rules
(10 product rules + 5 implementation invariants)
1. One entry → multiple notes; one note → multiple categories.
2. Entity extraction + co-reference are automatic — no user involvement.
3. No pattern surfaced under 3 data points.
4. Every nudge references something the user actually said — never generic.
5. Weekly letter: no bullet points, numbered lists, or templates.
6. All data strictly private to its user — zero cross-user access (RLS-enforced).
7. Loose ends auto-detect, auto-resolve, manually dismissable.
8. Mood/emotion exposed as observations/trends only — never raw scores.
9. Ask Nara grounded only in the user's notes — no hallucination.
10. Account deletion removes everything — no orphaned data.
11. Entities are find-or-create on `(user_id, type, lower(name))` — no duplicates.
12. Co-occurrence rows are canonical-ordered (`a_id < b_id`) — no split counts.
13. Pipeline is idempotent on `entry_id` — retries are safe.
14. Embedding failure is non-fatal — notes still appear.
15. `emotion_score` never crosses the API boundary.

## 12. Tests
- API: `pnpm --filter @nara/api test` (vitest). Route + schema + auth-isolation tests.
- Worker: `uv run pytest`. Extraction golden tests, entity-registry idempotency tests,
  co-occurrence canonical-order tests, RAG grounding test (empty-retrieval → refusal).
Run before any handoff.

## 13. Current implementation state
### Done
- All planning docs (ARCHITECTURE, DATABASE_SCHEMA, API_CONTRACT, ADR-001..003).
- Monorepo skeleton (pnpm workspace, .gitignore, .env.example).
### In progress
- (nothing yet — scaffolding apps is the next step)
### Queued (dependency order)
1. Scaffold `apps/api` (Fastify + TS + Zod + Supabase client + pg-boss producer).
2. Scaffold `apps/ai-worker` (uv + FastAPI + worker loop + clients).
3. `packages/shared` types (Note, Entity, etc. from API_CONTRACT).
4. SQL migrations (all 13 tables + indexes + RLS).
5. Extraction prompt + pipeline + persistence (entity registry, co-occurrence).
6. Embeddings + note_embeddings writes.
7. API CRUD: auth, entries, notes, categories, entities, loose-ends.
8. Ask Nara (RAG).
9. Scheduled jobs: detect_patterns, weekly_letter, evaluate_nudges, sweeper.
10. mood + notifications/preferences endpoints + DELETE /account.

## 14. Known issues / tech debt
- Entity aliases ("Mom"/"my mother" → one entity) not yet modeled; extractor
  normalizes for now. `entity_aliases` table is the planned fix.
- ivfflat `lists=100`; revisit at scale.
