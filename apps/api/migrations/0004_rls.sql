-- 0004_rls.sql
-- Row-Level Security on every user-owned table (Behavioral Rule #6 — zero
-- cross-user access, enforced at the database layer).
--
-- Tables with a user_id column use `user_id = auth.uid()`.
-- The two pure join tables (note_categories, note_entities) have no user_id;
-- they inherit scope from their parent note via an EXISTS check.
--
-- The Python worker connects with the service_role key, which BYPASSES RLS;
-- it scopes by user_id explicitly in every query (see DATABASE_SCHEMA.md).

-- ── helper: a single owner policy applied for all commands ──────────────────
-- (Written out per-table for clarity rather than a function.)

-- entries
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries FORCE ROW LEVEL SECURITY;
CREATE POLICY entries_owner ON entries
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
CREATE POLICY notes_owner ON notes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
CREATE POLICY categories_owner ON categories
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- entities
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;
CREATE POLICY entities_owner ON entities
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- entity_cooccurrences
ALTER TABLE entity_cooccurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_cooccurrences FORCE ROW LEVEL SECURITY;
CREATE POLICY entity_cooccurrences_owner ON entity_cooccurrences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- note_embeddings
ALTER TABLE note_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_embeddings FORCE ROW LEVEL SECURITY;
CREATE POLICY note_embeddings_owner ON note_embeddings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- loose_ends
ALTER TABLE loose_ends ENABLE ROW LEVEL SECURITY;
ALTER TABLE loose_ends FORCE ROW LEVEL SECURITY;
CREATE POLICY loose_ends_owner ON loose_ends
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- patterns
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns FORCE ROW LEVEL SECURITY;
CREATE POLICY patterns_owner ON patterns
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- weekly_letters
ALTER TABLE weekly_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_letters FORCE ROW LEVEL SECURITY;
CREATE POLICY weekly_letters_owner ON weekly_letters
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- nudges
ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudges FORCE ROW LEVEL SECURITY;
CREATE POLICY nudges_owner ON nudges
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_owner ON notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── join tables: scope through the parent note ──────────────────────────────
-- note_categories
ALTER TABLE note_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY note_categories_owner ON note_categories
  FOR ALL
  USING (EXISTS (SELECT 1 FROM notes n WHERE n.id = note_categories.note_id AND n.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM notes n WHERE n.id = note_categories.note_id AND n.user_id = auth.uid()));

-- note_entities
ALTER TABLE note_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_entities FORCE ROW LEVEL SECURITY;
CREATE POLICY note_entities_owner ON note_entities
  FOR ALL
  USING (EXISTS (SELECT 1 FROM notes n WHERE n.id = note_entities.note_id AND n.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM notes n WHERE n.id = note_entities.note_id AND n.user_id = auth.uid()));
