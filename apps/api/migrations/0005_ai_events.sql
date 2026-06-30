-- ai_events: one row per AI call (LLM or embedding). This is the cost + behavior
-- ledger. Written by the Python worker via the DATABASE_URL connection (which
-- bypasses RLS), never exposed through the public API, so no anon access path exists.
-- We store token counts, latency, and computed cost — never note content (privacy).

CREATE TABLE IF NOT EXISTS ai_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  user_id        uuid,                         -- nullable: some calls have no user context
  operation      text NOT NULL,                -- extraction | ask | letter | embedding
  model          text NOT NULL,
  prompt_version text,
  input_tokens   int  NOT NULL DEFAULT 0,
  output_tokens  int  NOT NULL DEFAULT 0,
  latency_ms     int,
  cost_usd       numeric(12,6) NOT NULL DEFAULT 0,
  success        boolean NOT NULL DEFAULT true,
  error          text,
  meta           jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_ai_events_user_created ON ai_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_events_op_created   ON ai_events(operation, created_at DESC);

-- Enable RLS with no policy: blocks the anon/auth roles entirely. The worker connects
-- as the database owner and bypasses RLS, which is the only writer/reader.
ALTER TABLE ai_events ENABLE ROW LEVEL SECURITY;
