# Nara — Database Schema

**Status:** Living document. Last updated 2026-06-19.
**Database:** Supabase Postgres 15+ with `pgvector`, `pgcrypto`, `pg_boss`.

This document is written **before** migrations. Migrations must match it exactly.
Every table, column, index, FK, and constraint is specified, with rationale for
every non-obvious choice.

---

## Conventions

- All ids are `uuid` default `gen_random_uuid()` (pgcrypto).
- All timestamps are `timestamptz`, default `now()`.
- `user_id` always references `auth.users(id)` and is **NOT NULL**.
- Every user-owned table has **Row-Level Security** enabled with a policy
  `user_id = auth.uid()` for select/insert/update/delete. This enforces Behavioral
  Rule #6 (zero cross-user access) at the database layer. The Python worker uses the
  service role and scopes by `user_id` explicitly in every query.
- Deletes cascade via FK `ON DELETE CASCADE` so account deletion (Rule #10) removes
  everything with no orphans.

---

## Entity-relationship overview

```
auth.users
   │ 1
   ├──< entries ──< notes ──< note_categories >── categories
   │                  │
   │                  ├──< note_entities >── entities
   │                  ├──1 note_embeddings
   │                  └──< loose_ends
   │
   ├──< entities ──< entity_cooccurrences >── entities (self, canonical a<b)
   ├──< patterns
   ├──< weekly_letters
   ├──< nudges
   └──1 notification_preferences
```

`<` = one-to-many, `>──<` = many-to-many join, `1` = one-to-one.

---

## Tables

### entries
The raw input unit. Phase 1: text. Phase 2: gains `storage_path` + `duration_sec`
and is conceptually a "recording".

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | RLS scope |
| raw_text | text NOT NULL | the typed/transcribed text |
| status | text NOT NULL default 'pending' | CHECK in (pending, processing, done, failed) |
| error | text NULL | failure reason when status=failed |
| storage_path | text NULL | **Phase 2** audio object path |
| duration_sec | int NULL | **Phase 2** |
| created_at | timestamptz NOT NULL | |
| processed_at | timestamptz NULL | set when status→done |

Index: `(user_id, created_at desc)`.
Rationale: status is a lifecycle the client polls; `processed_at` separates "when
said" from "when ready". Keeping audio columns nullable now means Phase 2 is an
additive migration, not a rewrite.

---

### notes
One entry → many notes. The atomic unit of memory. `emotion_score` lives here, per
note — this is what powers "your Work notes were heavier this week."

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| entry_id | uuid NOT NULL → entries ON DELETE CASCADE | source |
| content | text NOT NULL | cleaned, extracted note text |
| emotion_score | real NULL | −1.0..1.0, **internal only, never returned raw** |
| created_at | timestamptz NOT NULL | inherits entry time |
| updated_at | timestamptz NOT NULL | bumped on edit/append |

Indexes: `(user_id, created_at desc)` (feed), `(entry_id)`.
Rationale: emotion_score is `real` (single precision is plenty for a −1..1 score) and
nullable so a note with no detectable tone isn't forced to a fake 0. The API layer
must never serialize this field to clients (Rule #8) — only derived mood
observations are exposed.

---

### categories
Emergent, **per-user**. Not a global enum. Two users' "Books" are different rows.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| name | text NOT NULL | |
| color | text NOT NULL | hex; assigned from palette on create |
| note_count | int NOT NULL default 0 | denormalized counter |
| created_at | timestamptz NOT NULL | |

Constraint: `UNIQUE (user_id, lower(name))` — find-or-create is case-insensitive so
"books" and "Books" don't split.
Rationale: per-user emergent categories are core to the product (no buckets to
maintain). `note_count` is denormalized for cheap feed/category-list reads; it is
maintained transactionally with note_categories writes.

---

### note_categories
Many-to-many: one note can be in multiple categories (Rule #1).

| column | type | notes |
|--------|------|-------|
| note_id | uuid NOT NULL → notes ON DELETE CASCADE | |
| category_id | uuid NOT NULL → categories ON DELETE CASCADE | |
| PK | (note_id, category_id) | |

Index: `(category_id)` for "notes in a category".

---

### entities — the crown jewel
Every person, topic, place the user mentions. The graph's nodes.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| name | text NOT NULL | canonical display name (e.g. "Rohan") |
| entity_type | text NOT NULL | CHECK in (person, topic, place, other) |
| mention_count | int NOT NULL default 1 | denormalized |
| first_mentioned_at | timestamptz NOT NULL | |
| last_mentioned_at | timestamptz NOT NULL | |
| created_at | timestamptz NOT NULL | |

Constraint: `UNIQUE (user_id, entity_type, lower(name))`.
Indexes: `(user_id, entity_type)`, `(user_id, last_mentioned_at desc)`.
Rationale: find-or-create keyed on `(user_id, type, lower(name))` prevents duplicate
nodes — duplicate entities are Risk #1, the thing that poisons everything. The type
is part of the key so a place "Nara" and a person "Nara" can coexist.
Co-reference resolution ("he"→Rohan, "my boyfriend"→Rohan) happens **inside** the
extraction step before this table is touched, so only resolved canonical names land
here. Alias handling (multiple surface forms → one entity) is a tracked future
enhancement (`entity_aliases` table) — see Open Questions.

---

### note_entities
Which entities appear in which note. Graph edges note→entity, with the grounding
snippet Ask Nara uses to cite.

| column | type | notes |
|--------|------|-------|
| note_id | uuid NOT NULL → notes ON DELETE CASCADE | |
| entity_id | uuid NOT NULL → entities ON DELETE CASCADE | |
| context_snippet | text NULL | the sentence the entity appeared in |
| PK | (note_id, entity_id) | |

Index: `(entity_id)` — powers the per-entity timeline (Person Detail screen).

---

### entity_cooccurrences — the pattern engine
When two entities appear in the same note, their bond strengthens. This table makes
"the last 3 times you felt overwhelmed, Work came up" computable with one query.

| column | type | notes |
|--------|------|-------|
| user_id | uuid NOT NULL → auth.users | |
| entity_a_id | uuid NOT NULL → entities ON DELETE CASCADE | **always the smaller uuid** |
| entity_b_id | uuid NOT NULL → entities ON DELETE CASCADE | **always the larger uuid** |
| count | int NOT NULL default 1 | times co-mentioned |
| last_seen_at | timestamptz NOT NULL | |
| PK | (user_id, entity_a_id, entity_b_id) | |

Constraint: `CHECK (entity_a_id < entity_b_id)`.
Index: `(user_id, count desc)` — find strongest bonds / threshold scans.
Rationale (the important one): co-occurrence is symmetric — (Rohan, Work) and
(Work, Rohan) are the same fact. We enforce a canonical order (`a_id < b_id` by uuid
comparison) so the pair maps to exactly one row. Without this, the same bond splits
across two rows and every count is wrong — silently corrupting pattern detection.
The upsert is `ON CONFLICT (user_id, entity_a_id, entity_b_id) DO UPDATE SET count =
count + 1, last_seen_at = now()`.

---

### note_embeddings — isolated on purpose
Vector representation of each note for semantic search / RAG. Separate table.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| note_id | uuid NOT NULL UNIQUE → notes ON DELETE CASCADE | |
| user_id | uuid NOT NULL → auth.users | |
| embedding | vector(1536) NOT NULL | OpenAI 3-small |
| model | text NOT NULL default 'text-embedding-3-small' | for future re-embeds |
| created_at | timestamptz NOT NULL | |

Index: `ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`.
Rationale for the **separate table**: a 1536-dim vector is ~6KB. If it lived on
`notes`, every `SELECT * FROM notes` for the feed would haul 6KB/row of binary the UI
never uses. Isolation keeps the hot path lean; we only join embeddings during Ask
Nara / semantic search. `model` is stored so a future embedding-model upgrade can
re-embed incrementally. `lists=100` suits low-thousands of vectors; revisit if a user
exceeds ~50k notes.

---

### loose_ends
Intentions auto-detected from language; auto-resolved from completion language;
manually dismissable (Rule #7).

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| note_id | uuid NOT NULL → notes ON DELETE CASCADE | source note |
| intention_text | text NOT NULL | cleaned statement ("Call Mom this weekend") |
| status | text NOT NULL default 'open' | CHECK in (open, resolved, dismissed) |
| resolved_note_id | uuid NULL → notes ON DELETE SET NULL | what resolved it |
| resolved_at | timestamptz NULL | |
| created_at | timestamptz NOT NULL | |

Index: `(user_id, status)` — the open-loose-ends list.
Rationale: keeping a link to both the source note and the resolving note lets the
weekly letter say "you mentioned X on Monday and came back to it Thursday."

---

### patterns
Derived, surfaced only at ≥3 data points (Rule #3). Inputs to nudges + letters.

| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| pattern_type | text NOT NULL | CHECK in (cooccurrence, emotional_arc, temporal, frequency) |
| description | text NOT NULL | human-readable, e.g. "Work and stress recur together" |
| entity_ids | uuid[] NOT NULL default '{}' | entities involved |
| data_points | int NOT NULL | must be ≥3 to be active |
| is_active | boolean NOT NULL default true | de-activated when no longer holds |
| first_detected_at | timestamptz NOT NULL | |
| last_confirmed_at | timestamptz NOT NULL | |

Index: `(user_id, is_active)`.
Constraint: `CHECK (data_points >= 3)` — the rule is enforced by the schema, not just
code.

---

### weekly_letters
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| content | text NOT NULL | the letter prose |
| week_start | date NOT NULL | |
| week_end | date NOT NULL | |
| delivered_at | timestamptz NULL | null until pushed |
| created_at | timestamptz NOT NULL | |

Constraint: `UNIQUE (user_id, week_start)` — one letter per user per week, idempotent
re-runs.

---

### nudges
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid NOT NULL → auth.users | |
| nudge_type | text NOT NULL | CHECK in (inactivity, loose_end, pattern, unresolved, entity_silence) |
| content | text NOT NULL | always references real content (Rule #4) |
| entity_id | uuid NULL → entities ON DELETE SET NULL | |
| source_note_id | uuid NULL → notes ON DELETE SET NULL | the "something you said" |
| delivered_at | timestamptz NULL | |
| dismissed_at | timestamptz NULL | |
| created_at | timestamptz NOT NULL | |

Index: `(user_id, created_at desc)`, `(user_id, nudge_type, created_at desc)` for the
48h-per-type cooldown check.
Rationale: `source_note_id`/`entity_id` make the "reference real content" rule
structural — a nudge without a grounding reference shouldn't be generated.

---

### notification_preferences
One row per user. Quiet hours + per-nudge-type opt-out (PUT /notifications/preferences).

| column | type | notes |
|--------|------|-------|
| user_id | uuid PK → auth.users | one-to-one |
| quiet_hours_start | int NOT NULL default 22 | local hour 0–23 (10pm) |
| quiet_hours_end | int NOT NULL default 8 | local hour 0–23 (8am) |
| timezone | text NOT NULL default 'UTC' | IANA tz; drives letter + nudge timing |
| enabled_types | text[] NOT NULL default '{inactivity,loose_end,pattern,unresolved,entity_silence}' | per-type opt-in |
| expo_push_token | text NULL | **Phase 2/3** |
| created_at | timestamptz NOT NULL | |
| updated_at | timestamptz NOT NULL | |

Rationale: quiet hours + timezone live here so both the nudge job and the Sunday
letter job can resolve "evening in the user's local time" from one place.

---

## Vector vs relational — what lives where

- **Relational (everything above except embeddings):** all structured truth —
  notes, the entity graph, patterns, letters. Joins and counters power the feed,
  timelines, and pattern detection.
- **Vector (`note_embeddings.embedding`):** only the semantic meaning of note text,
  used solely for Ask Nara retrieval. It is derived data — if lost, it can be
  rebuilt by re-embedding note content. It lives in the *same* Postgres (pgvector)
  for transactional consistency, but in its own table for the performance reason
  above.

---

## Deletion & retention (Rule #10)

Account deletion deletes the `auth.users` row; every table cascades from `user_id`
or transitively via `entry_id`/`note_id` cascades. Verified deletion targets:
entries, notes, categories, note_categories, entities, note_entities,
entity_cooccurrences, note_embeddings, loose_ends, patterns, weekly_letters, nudges,
notification_preferences, **and** (Phase 2) every Storage audio object under the
user's prefix (deleted by an explicit pre-delete hook, since Storage objects are not
FK-cascaded). A `DELETE /account` endpoint orchestrates: purge Storage → delete
auth user (cascades the rest) → confirm zero rows remain for that user_id across all
tables (a deletion-audit query).

---

## Open questions / tracked enhancements

1. **Entity aliases** — multiple surface forms ("Mom", "my mother") mapping to one
   entity. Phase 1 relies on the extractor normalizing to a canonical name; a
   dedicated `entity_aliases (entity_id, alias, lower-unique)` table is the planned
   robust solution. Tracked in CLAUDE.md.
2. **ivfflat list tuning** — `lists=100` is fine for beta; revisit at scale or move
   to `hnsw` if recall/latency needs it.
3. **emotion_score model** — single score per note for now; a multi-axis affect
   model (valence/arousal) is a possible future refinement, additive.
