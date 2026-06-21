-- 0003_indexes.sql
-- Performance indexes from docs/DATABASE_SCHEMA.md (UNIQUE/find-or-create indexes
-- live with their tables in 0002).

-- entries: feed by user, newest first
CREATE INDEX entries_user_created_idx ON entries (user_id, created_at DESC);

-- notes: feed + "notes for an entry"
CREATE INDEX notes_user_created_idx ON notes (user_id, created_at DESC);
CREATE INDEX notes_entry_idx ON notes (entry_id);

-- note_categories: "notes in a category"
CREATE INDEX note_categories_category_idx ON note_categories (category_id);

-- entities: type listing + recency
CREATE INDEX entities_user_type_idx ON entities (user_id, entity_type);
CREATE INDEX entities_user_last_mentioned_idx ON entities (user_id, last_mentioned_at DESC);

-- note_entities: per-entity timeline (Person Detail)
CREATE INDEX note_entities_entity_idx ON note_entities (entity_id);

-- entity_cooccurrences: strongest bonds / threshold scans
CREATE INDEX entity_cooccurrences_user_count_idx ON entity_cooccurrences (user_id, count DESC);

-- note_embeddings: approximate-nearest-neighbour cosine search.
-- lists=100 suits low-thousands of vectors; revisit (or move to hnsw) at scale.
CREATE INDEX note_embeddings_embedding_idx
  ON note_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- loose_ends: the open-loose-ends list
CREATE INDEX loose_ends_user_status_idx ON loose_ends (user_id, status);

-- patterns: active patterns per user
CREATE INDEX patterns_user_active_idx ON patterns (user_id, is_active);

-- nudges: recent list + per-type cooldown (48h) check
CREATE INDEX nudges_user_created_idx ON nudges (user_id, created_at DESC);
CREATE INDEX nudges_user_type_created_idx ON nudges (user_id, nudge_type, created_at DESC);
