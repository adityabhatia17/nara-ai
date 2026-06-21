# Nara — Architecture

**Status:** Living document. Last updated 2026-06-19.
**Owner:** Principal Architect (Agent 1).

This is the single source of truth for every technology decision in Nara. Every
choice below lists the decision, the rejected alternatives, and the reasoning.

---

## 0. Product in one paragraph

Nara is a voice-first personal memory app. The user talks (Phase 1: types) freely
with no structure. Nara transcribes, extracts entities (people, topics, emotions,
intentions), splits the input into multiple organized notes, embeds them for
semantic recall, maintains a per-user entity graph, detects behavioral patterns,
and produces warm weekly letters and specific nudges. Target scale: a closed beta
of 20–50 invited users. Cost ceiling: ~$50–100/month.

---

## 1. Guiding principles

1. **Minimize services.** Every additional managed service is operational tax.
   At 20–50 users we collapse persistence, auth, storage, and vector search into
   one platform (Supabase) and the queue into the database itself (pg-boss).
2. **Right model for the right job.** Cheap fast model for high-frequency tasks
   (entity extraction), quality model only for the emotional core (weekly letter,
   Ask Nara). Open-source models by default.
3. **Not everything needs an LLM.** Pattern detection is SQL and graph math.
   LLMs are for language, not counting.
4. **Design for the unhappy path.** Transcription fails, the LLM returns garbage,
   vector search returns nothing, a job crashes mid-pipeline. These are guaranteed,
   not edge cases. The pipeline is idempotent and resumable.
5. **The entity graph is the crown jewel.** Everything downstream (patterns,
   letters, nudges, Ask Nara) is only as good as the graph. We over-invest here.

---

## 2. Technology decisions

### 2.1 Backend runtime & language — split: Node.js (API) + Python (AI worker)

- **Decision:** TypeScript on Node 20 + Fastify for the client-facing API.
  Python 3.12 + FastAPI for the AI worker.
- **Rejected:** Single Python backend (FastAPI everything); single Node backend.
- **Reasoning:** Node/TypeScript gives us end-to-end type safety with the shared
  types package the frontend also consumes, and Fastify is fast with schema
  validation built in. Python owns the AI pipeline because the AI/ML ecosystem
  (model SDKs, future local-model experimentation, data tooling) is strongest
  there, and the user wants to grow Python AI skills. The split lets each side use
  its best ecosystem without compromise.

### 2.2 Service communication — pg-boss job queue inside Postgres

- **Decision:** Node enqueues jobs into pg-boss (a queue that lives in Postgres).
  The Python worker polls pg-boss and processes the pipeline, writing results back
  to Postgres directly.
- **Rejected:** Redis + BullMQ/RQ (Upstash); synchronous internal HTTP (Node→Python).
- **Reasoning:** pg-boss adds zero new infrastructure — the queue is just tables in
  the database we already run. It gives retries, backoff, and crash-resilience for
  free. Synchronous HTTP was rejected because a crashed Python call would fail with
  no retry and long inputs would block the response. Redis was rejected because it
  is one more managed service for a real-time guarantee we do not need at this scale
  (a 2-second poll is imperceptible in an async pipeline).

### 2.3 Primary database — Supabase Postgres

- **Decision:** Supabase Pro (managed Postgres 15+).
- **Rejected:** MongoDB Atlas; PlanetScale (MySQL); self-hosted Postgres.
- **Reasoning:** Our data is deeply relational (notes ↔ categories ↔ entities ↔
  co-occurrences) — a relational store with real foreign keys and joins is the
  correct model, not a document store. Supabase bundles Postgres + pgvector + Auth
  + Storage in one platform, eliminating three separate services. Open-source and
  self-hostable, so no lock-in.

### 2.4 Vector search — pgvector inside the same Postgres

- **Decision:** `pgvector` extension, `vector(1536)` column, `ivfflat` index for
  approximate nearest-neighbour cosine search. Embeddings isolated in their own
  `note_embeddings` table.
- **Rejected:** Pinecone; Qdrant; Weaviate.
- **Reasoning:** A dedicated vector DB is a second datastore to sync, secure, and
  pay for. At a few thousand notes per user, pgvector is more than fast enough and
  keeps vectors transactionally consistent with the notes they belong to. Isolating
  embeddings in their own table keeps the hot notes-feed queries from dragging 6KB
  vectors across the wire (see DATABASE_SCHEMA.md §note_embeddings).

### 2.5 Audio storage — Supabase Storage (Phase 2 only)

- **Decision:** Supabase Storage bucket, private, per-user path prefix. **Deferred
  to Phase 2.** Phase 1 has no audio.
- **Rejected:** AWS S3; Cloudflare R2.
- **Reasoning:** Same platform as the database = one set of credentials, one access
  model, RLS-aligned. R2/S3 would be marginally cheaper at huge scale but add an
  account and SDK for no benefit at 20–50 users. Phase 1 takes text input directly,
  so storage is not built until the AI core is proven (see §6 Phasing).

### 2.6 Transcription — Groq Whisper (Phase 2 only)

- **Decision:** Groq-hosted `whisper-large-v3-turbo`. **Deferred to Phase 2.**
- **Rejected:** Self-hosted Whisper; AssemblyAI; Deepgram.
- **Reasoning:** Groq Whisper is ~$0.0001/sec, extremely fast, zero ops. Self-hosting
  means always-on GPU/CPU cost for bursty load. AssemblyAI/Deepgram are excellent but
  pricier and add a vendor for accuracy we do not yet need. Phase 1 skips audio
  entirely to isolate and validate the language pipeline first.

### 2.7 LLM provider — Groq, tiered by task

- **Decision:**
  - **Entity extraction** (every entry, high frequency): `llama-3.1-8b-instant`.
  - **Weekly letter + Ask Nara synthesis** (low frequency, high stakes):
    `llama-3.3-70b-versatile`.
  - All via Groq, all open-weight Llama models.
- **Rejected:** GPT-4o / GPT-4o-mini for everything; Claude for everything; a single
  model for all tasks.
- **Reasoning:** Entity extraction is structured parsing that runs constantly — the
  8B model is accurate enough with a good prompt and costs almost nothing. The weekly
  letter is the emotional core where quality earns trust, so it gets the 70B model;
  it runs once per user per week, so cost is negligible. Open-weight Llama keeps us
  aligned with the user's open-source preference and avoids per-token premium pricing.
  A single model would either overpay on extraction or underdeliver on letters.

### 2.8 Embeddings — OpenAI text-embedding-3-small

- **Decision:** OpenAI `text-embedding-3-small`, 1536 dimensions.
- **Rejected:** OpenAI `text-embedding-3-large`; open-source `bge`/`e5` self-hosted;
  Cohere embeddings.
- **Reasoning:** Groq does not offer an embeddings endpoint, so we need one external
  provider here. `3-small` is ~$0.02 per million tokens — effectively free at this
  scale — with strong retrieval quality. `3-large` doubles cost/dimensions for a gain
  we don't need. Self-hosting embeddings reintroduces always-on compute we explicitly
  avoided for transcription. This is the one pragmatic closed-model dependency; it is
  swappable behind an interface if we later self-host.

### 2.9 Background jobs — pg-boss (Node side) + worker loop (Python side)

- **Decision:** pg-boss owns the queue. The Python worker subscribes/polls. Scheduled
  jobs (daily pattern detection, Sunday letters, nudge evaluation) are pg-boss cron
  jobs.
- **Rejected:** Celery (needs a broker); Temporal (heavy); OS cron.
- **Reasoning:** pg-boss already supports scheduled (cron) jobs, so the same mechanism
  drives both the post-entry pipeline and the recurring intelligence jobs. No broker,
  no extra service. Celery/Temporal are overkill for this scale.

### 2.10 Authentication — Supabase Auth

- **Decision:** Supabase Auth (email magic link for beta; JWT). RLS enforced at the
  database level so every row is scoped to `auth.uid()`.
- **Rejected:** Clerk; Auth0; roll-our-own JWT.
- **Reasoning:** Auth is bundled with the database we already chose, and its JWTs
  integrate directly with Postgres Row-Level Security — meaning data isolation
  (Behavioral Rule #6, zero cross-user access) is enforced by the database, not just
  application code. This is a security property we get for free. Clerk/Auth0 are great
  but are another vendor and another bill.

### 2.11 Push notifications — Expo Push (Phase 2/3)

- **Decision:** Expo Push Notifications for nudges and the weekly-letter ping.
  Backend stores Expo push tokens; the nudge/letter jobs send via Expo's HTTP/2 API.
- **Rejected:** Raw FCM/APNs; OneSignal.
- **Reasoning:** The app is Expo/React Native, so Expo Push is the native, zero-cost,
  single-API path to both iOS and Android. Raw FCM/APNs means managing two platform
  integrations. Phasing: nudge/letter *generation* is built early; *delivery* via push
  lands when the mobile app exists.

### 2.12 API style — REST (Fastify, JSON)

- **Decision:** REST over HTTP/JSON, documented in API_CONTRACT.md, validated with
  JSON Schema / Zod, types shared via `packages/shared`.
- **Rejected:** tRPC; GraphQL.
- **Reasoning:** REST is the clearest binding contract between independently built
  backend and frontend agents, and it's trivial to test with curl. tRPC couples the
  client to the server's TypeScript and complicates a future non-TS client. GraphQL's
  flexibility is unnecessary for a fixed, well-known set of endpoints and adds resolver
  complexity. We still get type safety by sharing types through `packages/shared`.

### 2.13 Monorepo tooling — pnpm workspaces

- **Decision:** pnpm workspaces. `apps/api`, `apps/ai-worker`, `apps/mobile`,
  `packages/shared`.
- **Rejected:** Nx; Turborepo; Yarn/npm workspaces.
- **Reasoning:** pnpm workspaces are lightweight and fast and handle the JS/TS side
  cleanly. The Python worker lives in the same repo but manages its own venv/deps
  (pyproject + uv) — it doesn't need JS tooling. Nx/Turborepo add caching/orchestration
  we don't need for two-plus-one apps; their benefit appears at much larger monorepos.

### 2.14 Frontend stack — React Native + Expo (locked)

- **Decision:** React Native + Expo (managed workflow). Locked by product spec.
- **Reasoning:** Locked. Expo gives OTA updates, painless native module access, Expo
  Push, and the fastest path to both stores from one codebase.

### 2.15 Frontend state management — Zustand + TanStack Query

- **Decision:** TanStack Query (React Query) for all server state; Zustand for the
  small amount of local/UI state (recording state, active filters, nav-adjacent UI).
- **Rejected:** Redux Toolkit; Jotai; Context-only.
- **Reasoning:** Nearly all of Nara's state is *server* state (notes, entities,
  letters) — TanStack Query handles caching, polling (the recording-status poll!),
  retries, and optimistic updates idiomatically. Zustand covers the tiny slice of
  genuinely local state with almost no boilerplate. Redux is too heavy for how little
  client-only state exists. See CLAUDE_FRONTEND.md for store shape.

### 2.16 Frontend navigation — Expo Router

- **Decision:** Expo Router (file-based, built on React Navigation). A bottom tab
  navigator (Talk / Notes / Ask / People) with stacks inside; Listening, Processing,
  Reveal as full-screen routes without the tab bar; Nudges as a modal overlay.
- **Rejected:** Bare React Navigation; React Native Navigation (Wix).
- **Reasoning:** Expo Router is the first-party Expo solution, gives typed routes and
  deep linking (needed for nudge/letter taps that open a specific screen), and maps
  cleanly onto the ten-screen spec. It is React Navigation under the hood, so nothing
  is lost.

### 2.17 Deployment & hosting — Railway (services) + Supabase (data) + EAS (mobile)

- **Decision:** Railway hosts the Node API and the Python worker as two services from
  the monorepo. Supabase hosts data/auth/storage. Expo EAS builds and ships the app.
- **Rejected:** Fly.io; Render; AWS ECS/Lambda.
- **Reasoning:** Railway deploys directly from the repo with minimal config, runs both
  a Node and a Python service comfortably, and is cheap (~$10–15/mo combined here).
  Render is comparable; Railway chosen for nicer monorepo DX. AWS is far more control
  and far more operational tax than this beta warrants.

### 2.18 Local development — docker-compose optional; Supabase cloud default

- **Decision:** Default dev points at a Supabase cloud "dev" project. A
  `supabase start` (local Supabase via Docker) option exists for offline work. Node
  and Python run locally via `pnpm dev` and `uv run`. A single `scripts/dev.sh`
  brings everything up.
- **Rejected:** Mandatory full Docker stack.
- **Reasoning:** Pointing at a cloud dev project is the fastest path to a working
  environment and mirrors production exactly (pgvector, RLS, auth). Local Supabase is
  available for those who want it but not required.

### 2.19 CI/CD — GitHub Actions

- **Decision:** GitHub Actions: lint + typecheck + test on PR for both apps; Railway
  auto-deploys `main`; EAS build triggered manually/tagged.
- **Rejected:** No CI; Railway-only.
- **Reasoning:** Actions is free for this scale and gives a quality gate (the 8B
  extraction prompt and pipeline have tests that must pass). Railway's git integration
  handles deploy on green main.

---

## 3. System topology

```
                       ┌─────────────────────────────┐
   React Native /      │      Supabase (managed)      │
   Expo app  ─────────▶│  Auth (JWT)                  │
        │   HTTPS/REST  │  Postgres 15 + pgvector      │
        │              │   ├─ app tables (RLS)         │
        ▼              │   ├─ note_embeddings (vector) │
  ┌───────────────┐    │   └─ pg-boss queue tables     │
  │  Node API     │───▶│  Storage (audio, Phase 2)     │
  │  (Fastify/TS) │    └─────────────────────────────┘
  │  Railway      │            ▲           ▲
  └───────────────┘            │ writes    │ polls queue
        │ enqueues job         │ results   │
        └──────────────────────┘           │
                                           │
                                  ┌────────────────────┐
                                  │  Python AI worker   │
                                  │  (FastAPI/loop)     │
                                  │  Railway            │
                                  └────────────────────┘
                                     │        │        │
                                     ▼        ▼        ▼
                                  Groq    Groq 70B   OpenAI
                                  8B +    (letter,   embeddings
                                  Whisper Ask Nara)
                                  (P2)
```

- **Node API** owns: auth verification, all client CRUD reads/writes, enqueuing
  pipeline jobs, serving Ask Nara requests (it enqueues or calls the worker), serving
  notes/entities/letters/mood.
- **Python worker** owns: the entire AI pipeline, scheduled intelligence jobs
  (pattern detection, weekly letters, nudge evaluation), all LLM/embedding calls.
- **Postgres** is the integration point: the queue, the data, and the vectors all
  live here. Node and Python both connect to it directly.

---

## 4. The AI pipeline — tap-stop → notes visible

Phase 1 trigger is `POST /entries` with text. (Phase 2 prepends transcription.)

```
1. CLIENT     POST /entries { text }                                  ~instant
2. API        validate → insert entries row (status=pending)
              → enqueue pg-boss job "process_entry" { entry_id }
              → return 202 { entry_id, status: "pending" }            <100ms
3. CLIENT     poll GET /entries/:id/status every ~1.5s
4. WORKER     pick up job, set status=processing
5. WORKER     [Phase 2: transcribe audio → text]
6. WORKER     ENTITY EXTRACTION (Groq llama-3.1-8b, JSON mode)        ~1–3s
                input: transcript
                output: { notes[], people[], topics[],
                          emotion_score, intentions[] }
7. WORKER     persist:
                - notes rows
                - categories (find-or-create per user)
                - note_categories links
                - entities (find-or-create, ++mention_count)
                - note_entities (with context_snippet)
                - entity_cooccurrences (upsert, ++count, a<b rule)
                - loose_ends (from intentions; resolve via completion lang)
8. WORKER     EMBEDDING (OpenAI 3-small) per note → note_embeddings   ~0.5–1s
9. WORKER     set entries.status=done
10. CLIENT    poll returns status=done + note_ids → navigate to Reveal
```

**Latency budget:** target < 5s from POST to status=done for a typical entry.
Extraction dominates (1–3s). We chose async-with-poll over streaming partial results
because the Reveal screen wants the *complete* set of notes to animate in at once
(the product's first delight moment). The Processing screen's ~1.8s breathing
animation covers most of the wait perceptually.

**Idempotency & failure:** the job is keyed by `entry_id`. Each persistence step is
upsert-safe so a retried job after a mid-pipeline crash converges to the same state.
If extraction returns invalid JSON, the worker retries with a stricter reprompt
(max 2x); persistent failure sets `status=failed` and the client shows a gentle
retry affordance. A failed embedding does not fail the entry — notes still appear;
embedding is re-queued (Ask Nara degrades gracefully until it lands).

---

## 5. Data-flow diagrams for the three hard flows

### 5.1 Audio/text upload → notes appear
Covered in §4. Key handoffs: API→Postgres (entries row), API→pg-boss (job),
worker→Groq (extraction), worker→OpenAI (embeddings), worker→Postgres (results),
client poll→API→Postgres (status).

### 5.2 Ask Nara query → response (RAG)
```
1. CLIENT  POST /ask { question }
2. API     embed the question (OpenAI 3-small)
3. API     PARALLEL:
             a. vector search: cosine top-K (K≈10) over note_embeddings
                for this user → candidate notes
             b. entity graph query: if the question names a known entity,
                pull that entity's recent notes + stats
4. API     merge + dedupe candidates → build grounded context block
5. API     Groq llama-3.3-70b: system prompt = "answer ONLY from these notes,
             never fabricate, speak like someone who read everything"
             user prompt = question + context
6. API     return { answer, cited_note_ids }
```
Grounding rule (#9): if retrieval returns nothing relevant, the model is instructed
to say it hasn't heard about that yet — never invent.

### 5.3 Weekly letter generation
```
SCHEDULED  pg-boss cron, Sunday evening per user timezone
1. WORKER  collect week's notes (user, week_start..week_end)
2. WORKER  aggregate: emotion-by-day, top entities, active patterns,
             open loose_ends, resolved arcs (stressed→resolved)
3. WORKER  Groq llama-3.3-70b with the letter prompt
             (second person, warm, NO lists/bullets/templates,
              every claim grounded in real notes;
              target line: "You had a better week than Monday felt like")
4. WORKER  insert weekly_letters row (delivered_at=null)
5. WORKER  [Phase 2/3] send Expo push → set delivered_at
```
If a user had <N notes that week, the letter job writes a shorter, gentler letter or
skips (configurable threshold) rather than fabricating a full week.

---

## 6. Phasing

- **Phase 1 (now): the AI core, text-in.** Auth, entries (text), full extraction
  pipeline, notes/categories/entities/co-occurrences, embeddings, Ask Nara, loose
  ends, pattern detection, weekly letter generation, nudge generation. No audio, no
  Whisper, no Storage, no push delivery. Goal: prove the brain works.
- **Phase 2: voice.** Add Supabase Storage, Groq Whisper, the audio upload→poll flow.
  Rename `entries`→`recordings` semantics (add `storage_path`). Prepend transcription
  to the existing pipeline; nothing downstream changes.
- **Phase 3: the mobile app + delivery.** Build the ten screens against the frozen
  API contract. Wire Expo Push for nudges and the weekly letter.

---

## 7. Risk register

| # | Risk | Mitigation |
|---|------|------------|
| 1 | **Entity-graph corruption** (duplicate entities, double-counted co-occurrences) poisons every downstream feature. | Find-or-create entities by normalized name per user; enforce `entity_a_id < entity_b_id` canonical ordering on co-occurrence upserts; all counter updates in one transaction with the note write; idempotent job keyed on entry_id. |
| 2 | **8B model returns malformed/garbage JSON** for extraction. | Force JSON mode + strict schema; validate against Zod/pydantic; reprompt up to 2x with the validation error; on persistent failure mark entry `failed`, never write partial garbage. Prompt + schema versioned and unit-tested with golden inputs. |
| 3 | **Weekly letter reads generic** — the trust-killer. | 70B model + a heavily engineered prompt that forbids lists/templates and requires grounding in specific notes; letter prompt is versioned and reviewed; low-data weeks get a gentler short letter, never fabrication. |
| 4 | **Ask Nara hallucinates** beyond the user's notes. | Strict grounding system prompt; pass only retrieved notes as context; instruct explicit "I haven't heard about that" when retrieval is empty; return cited_note_ids so answers are traceable. |
| 5 | **Pipeline job crashes mid-way**, leaving inconsistent state or a stuck entry. | pg-boss retries with backoff; each step idempotent/upsert; embedding failure is non-fatal and separately re-queued; a sweeper re-queues entries stuck in `processing` past a timeout. |

Secondary risks tracked but lower: cross-user data leak (mitigated by Postgres RLS,
Rule #6), cost overrun (tiered models + cheap embeddings keep burn ~$40/mo), vendor
outage (Groq down → entries queue and retry; degraded, not lost).

---

## 8. Cost model (Phase 1, 20–50 users)

| Item | Estimate |
|------|----------|
| Supabase Pro | ~$25/mo |
| Railway (API + worker) | ~$10–15/mo |
| Groq (8B extraction + 70B letters/ask) | ~$5–15/mo |
| OpenAI embeddings (3-small) | <$1/mo |
| **Total** | **~$40–55/mo** |

Comfortably inside the $50–100 ceiling, leaving headroom for Phase 2 Whisper.
