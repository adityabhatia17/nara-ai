-- 0002_tables.sql
-- All 13 tables, matching docs/DATABASE_SCHEMA.md exactly.
-- Conventions:
--   * ids: uuid default gen_random_uuid()
--   * timestamps: timestamptz default now()
--   * user_id -> auth.users(id), NOT NULL
--   * FK ON DELETE CASCADE/SET NULL exactly as specified so account deletion
--     (Rule #10) cascades with no orphans.

-- ── entries ────────────────────────────────────────────────────────────────
CREATE TABLE entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error         text,
  storage_path  text,         -- Phase 2
  duration_sec  int,          -- Phase 2
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

-- ── notes ──────────────────────────────────────────────────────────────────
-- emotion_score is INTERNAL ONLY and must never be serialized (Rule #8).
CREATE TABLE notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id       uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  content        text NOT NULL,
  emotion_score  real,        -- -1.0..1.0, internal only, NEVER returned raw
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── categories ─────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL,
  note_count  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive find-or-create per user ("books" == "Books").
CREATE UNIQUE INDEX categories_user_lower_name_key
  ON categories (user_id, lower(name));

-- ── note_categories (M:N) ──────────────────────────────────────────────────
CREATE TABLE note_categories (
  note_id      uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, category_id)
);

-- ── entities — the crown jewel ──────────────────────────────────────────────
CREATE TABLE entities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text NOT NULL,
  entity_type         text NOT NULL
                        CHECK (entity_type IN ('person', 'topic', 'place', 'other')),
  mention_count       int NOT NULL DEFAULT 1,
  first_mentioned_at  timestamptz NOT NULL DEFAULT now(),
  last_mentioned_at   timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
-- Find-or-create key: (user_id, entity_type, lower(name)) — no duplicate nodes (Rule #11).
CREATE UNIQUE INDEX entities_user_type_lower_name_key
  ON entities (user_id, entity_type, lower(name));

-- ── note_entities (M:N + grounding snippet) ─────────────────────────────────
CREATE TABLE note_entities (
  note_id          uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entity_id        uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  context_snippet  text,
  PRIMARY KEY (note_id, entity_id)
);

-- ── entity_cooccurrences — the pattern engine ───────────────────────────────
-- Canonical order enforced so a symmetric bond maps to exactly one row (Rule #12).
CREATE TABLE entity_cooccurrences (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_a_id   uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entity_b_id   uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  count         int NOT NULL DEFAULT 1,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_a_id, entity_b_id),
  CONSTRAINT entity_cooccurrences_canonical_order CHECK (entity_a_id < entity_b_id)
);

-- ── note_embeddings — isolated on purpose (6KB vectors off the hot path) ─────
CREATE TABLE note_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding   vector(1536) NOT NULL,
  model       text NOT NULL DEFAULT 'text-embedding-3-small',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── loose_ends ──────────────────────────────────────────────────────────────
CREATE TABLE loose_ends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id           uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  intention_text    text NOT NULL,
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_note_id  uuid REFERENCES notes(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── patterns ────────────────────────────────────────────────────────────────
-- The >=3 data-points rule (Rule #3) is enforced by the schema, not just code.
CREATE TABLE patterns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type       text NOT NULL
                       CHECK (pattern_type IN ('cooccurrence', 'emotional_arc', 'temporal', 'frequency')),
  description        text NOT NULL,
  entity_ids         uuid[] NOT NULL DEFAULT '{}',
  data_points        int NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  first_detected_at  timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patterns_min_data_points CHECK (data_points >= 3)
);

-- ── weekly_letters ──────────────────────────────────────────────────────────
CREATE TABLE weekly_letters (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       text NOT NULL,
  week_start    date NOT NULL,
  week_end      date NOT NULL,
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_letters_user_week_key UNIQUE (user_id, week_start)
);

-- ── nudges ──────────────────────────────────────────────────────────────────
-- source_note_id / entity_id make "reference real content" (Rule #4) structural.
CREATE TABLE nudges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type      text NOT NULL
                    CHECK (nudge_type IN ('inactivity', 'loose_end', 'pattern', 'unresolved', 'entity_silence')),
  content         text NOT NULL,
  entity_id       uuid REFERENCES entities(id) ON DELETE SET NULL,
  source_note_id  uuid REFERENCES notes(id) ON DELETE SET NULL,
  delivered_at    timestamptz,
  dismissed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── notification_preferences (one row per user) ─────────────────────────────
CREATE TABLE notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quiet_hours_start  int NOT NULL DEFAULT 22,
  quiet_hours_end    int NOT NULL DEFAULT 8,
  timezone           text NOT NULL DEFAULT 'UTC',
  enabled_types      text[] NOT NULL
                       DEFAULT '{inactivity,loose_end,pattern,unresolved,entity_silence}',
  expo_push_token    text,    -- Phase 2/3
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
