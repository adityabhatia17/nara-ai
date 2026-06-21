# ADR-003: Node API + Python AI worker, integrated via pg-boss

## Status: Accepted (2026-06-19)

## Context
The backend has two very different kinds of work: (1) fast, transactional,
client-facing request/response (auth, CRUD, listing notes) and (2) slow, bursty,
AI-heavy processing (extraction, embedding, letters, pattern detection). The AI
ecosystem is strongest in Python; the type-shared API + frontend story is strongest
in TypeScript. We need these to communicate reliably, survive crashes, and add no
unnecessary infrastructure.

## Decision
Split into two services in one monorepo:
- **`apps/api`** — Node 20 + TypeScript + Fastify. Client-facing REST API, auth
  verification, all CRUD, and the *producer* that enqueues pipeline jobs.
- **`apps/ai-worker`** — Python 3.12 + FastAPI. The AI pipeline and all scheduled
  intelligence jobs; the *consumer* of jobs.

Integrate them through **pg-boss**, a job queue that lives inside the same Supabase
Postgres. Node enqueues; the Python worker consumes/polls and writes results back to
Postgres. Recurring jobs (daily pattern detection, Sunday letters, nudge evaluation)
are pg-boss scheduled (cron) jobs.

## Alternatives Considered
- **Single Python (FastAPI) backend, no Node:** rejected. Loses end-to-end TS type
  sharing with the frontend and the ergonomics of Fastify for the API layer; the user
  also wants TS for the backend API specifically.
- **Synchronous internal HTTP (Node → Python) with no queue:** rejected. A crashed or
  slow Python call fails the user's request with no retry; long inputs block the
  response. No resilience.
- **Redis + BullMQ (Node) / RQ (Python):** rejected. Adds a managed Redis service for
  a real-time guarantee we don't need. pg-boss reuses the database we already run.
- **Celery / Temporal:** rejected as overkill (broker / heavy runtime) for this scale.

## Consequences
- Zero new infrastructure for queuing — the queue is tables in Postgres. Retries,
  backoff, and crash-resilience come for free; scheduled jobs use the same mechanism.
- Both services connect directly to Postgres; Postgres is the integration seam, which
  keeps the contract simple (jobs in, rows out) and independently testable.
- Slight latency cost: the worker polls (~2s). Imperceptible inside an async,
  poll-for-status pipeline.
- Two runtimes to deploy (Railway handles both from the monorepo). Cross-language
  contracts (job payload shapes, row shapes) must be documented — they live in
  CLAUDE_BACKEND.md and are validated on both sides (Zod / pydantic).
