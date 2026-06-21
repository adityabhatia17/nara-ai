# ADR-001: Supabase Postgres as the single persistence platform

## Status: Accepted (2026-06-19)

## Context
Nara needs a primary database, vector search (for Ask Nara / semantic recall),
authentication, file storage (audio, Phase 2), and a job queue. We are a closed beta
(20–50 users) with a ~$50–100/mo budget and a preference for open-source and for
minimizing operational surface area. The data is deeply relational: notes link to
categories and entities, and entities link to each other through a co-occurrence
graph.

## Decision
Use **Supabase** as the single persistence platform:
- **Postgres 15+** as the primary relational database.
- **pgvector** extension for embeddings / semantic search (no separate vector DB).
- **Supabase Auth** for authentication, with JWTs that drive Postgres Row-Level
  Security.
- **Supabase Storage** for audio (Phase 2).
- **pg-boss** (a Postgres-backed queue) for background jobs — covered in ADR-003.

## Alternatives Considered
- **MongoDB Atlas:** rejected. Our model is relational (many-to-many notes↔entities,
  a self-referential co-occurrence graph). Enforcing that integrity in a document
  store means application-level joins and no real foreign keys — exactly where the
  entity graph (our crown jewel) would corrupt.
- **PlanetScale (MySQL):** rejected. No first-class vector type; would force a second
  vector service. No bundled auth/storage.
- **Postgres + Pinecone + Clerk + S3 (best-of-breed):** rejected. Four vendors, four
  bills, four security models, and the burden of keeping vectors in sync with rows.
  Unjustified at this scale.
- **Self-hosted Postgres:** rejected. We'd own backups, upgrades, pgvector setup, and
  uptime for no benefit over Supabase Pro at $25/mo.

## Consequences
- One platform, one bill (~$25/mo), one access model. RLS gives us database-enforced
  per-user isolation (Behavioral Rule #6) essentially for free.
- Vectors are transactionally consistent with their notes.
- We accept Supabase as a dependency; mitigated by it being open-source and
  self-hostable, so there is an exit path with no rewrite.
- pgvector's `ivfflat` is approximate; fine for beta. If recall/latency degrade at
  scale we move to `hnsw` — an index change, not an architecture change.
