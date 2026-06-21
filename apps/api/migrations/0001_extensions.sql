-- 0001_extensions.sql
-- Extensions must exist before any table that depends on them.
--   pgcrypto  -> gen_random_uuid()
--   vector    -> vector(1536) column + ivfflat index (note_embeddings)
-- pg-boss creates its own schema on init (worker side), not here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
