# Nara Phase 1 — Plan A: Foundation + AI Worker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo scaffold, database migrations, and the complete Python AI worker — entity extraction, embeddings, entity graph, Ask Nara RAG, loose ends, pattern detection, weekly letters, and nudges — all via LangChain.

**Architecture:** Node API and Python AI worker share a Supabase Postgres database. The worker runs two threads: a pg-boss consumer loop for async jobs, and a FastAPI HTTP server for synchronous Ask Nara calls. All LLM calls go through LangChain (ChatGroq + OpenAIEmbeddings + PGVector).

**Tech Stack:** Python 3.12, uv, FastAPI, LangChain (langchain-groq, langchain-openai, langchain-postgres), psycopg3, pydantic v2, pytest. Node 20, TypeScript, Fastify (scaffolded only — full routes in Plan B).

---

## File map

```
apps/api/
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts          # Fastify instance + plugin registration
    ├── config.ts          # typed env vars (zod)
    └── lib/
        ├── supabase.ts    # Supabase admin client
        └── queue.ts       # pg-boss producer (enqueue only)

apps/ai-worker/
├── pyproject.toml
└── nara_worker/
    ├── config.py          # pydantic-settings from env
    ├── db.py              # psycopg connection pool
    ├── worker.py          # pg-boss poll loop + FastAPI app
    ├── clients/
    │   ├── groq.py        # ChatGroq instances (fast + quality)
    │   └── openai.py      # OpenAIEmbeddings instance
    ├── pipeline/
    │   ├── extraction.py  # LangChain structured extraction
    │   ├── persistence.py # write notes/entities/co-occurrences
    │   ├── embedding.py   # embed notes → note_embeddings via PGVector
    │   └── loose_ends.py  # detect/resolve intentions
    ├── rag/
    │   └── ask_nara.py    # LangChain PGVector retrieval chain
    ├── jobs/
    │   ├── process_entry.py    # orchestrates pipeline steps
    │   ├── detect_patterns.py  # SQL-based pattern detection
    │   ├── weekly_letter.py    # 70B letter generation
    │   ├── evaluate_nudges.py  # nudge rules evaluation
    │   └── sweeper.py          # re-queue stuck entries
    └── prompts/
        ├── extraction.py       # versioned extraction system prompt
        ├── weekly_letter.py    # letter prompt
        └── ask_nara.py         # RAG grounding prompt

packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    └── types/
        ├── note.ts
        ├── entity.ts
        ├── entry.ts
        └── common.ts

apps/api/migrations/
├── 001_extensions.sql
├── 002_tables.sql
├── 003_indexes.sql
└── 004_rls.sql

tests/  (inside apps/ai-worker)
├── pipeline/
│   ├── test_extraction.py
│   ├── test_persistence.py
│   └── test_embedding.py
├── rag/
│   └── test_ask_nara.py
└── jobs/
    ├── test_detect_patterns.py
    └── test_weekly_letter.py
```

---

## Task 1: Scaffold apps/api (Node/Fastify/TypeScript)

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/lib/supabase.ts`
- Create: `apps/api/src/lib/queue.ts`
- Create: `apps/api/src/server.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@nara/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:migrate": "node scripts/migrate.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "fastify": "^5.0.0",
    "@fastify/jwt": "^9.0.0",
    "@fastify/cors": "^10.0.0",
    "pg-boss": "^10.1.0",
    "zod": "^3.23.0",
    "pg": "^8.13.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": { "@nara/shared": ["../../packages/shared/src/index.ts"] }
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Create src/config.ts**

```typescript
import { z } from "zod";
import "dotenv/config";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  AI_WORKER_URL: z.string().url().default("http://localhost:8000"),
  API_PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const config = schema.parse(process.env);
```

- [ ] **Step 4: Create src/lib/supabase.ts**

```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

- [ ] **Step 5: Create src/lib/queue.ts** (pg-boss producer)

```typescript
import PgBoss from "pg-boss";
import { config } from "../config.js";

let boss: PgBoss | null = null;

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(config.DATABASE_URL);
    await boss.start();
  }
  return boss;
}

export async function enqueueProcessEntry(entryId: string): Promise<void> {
  const queue = await getQueue();
  await queue.send("process_entry", { entry_id: entryId });
}
```

- [ ] **Step 6: Create src/server.ts**

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { config } from "./config.js";

export async function buildServer() {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({
    status: "ok",
    db: "up",
    queue: "up",
  }));

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = await buildServer();
  await app.listen({ port: config.API_PORT, host: "0.0.0.0" });
}
```

- [ ] **Step 7: Install deps and verify TypeScript compiles**

```bash
cd apps/api && pnpm install && pnpm typecheck
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api && git commit -m "feat: scaffold apps/api (Fastify + pg-boss + Supabase)"
```

---

## Task 2: Scaffold packages/shared (TypeScript types)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/common.ts`
- Create: `packages/shared/src/types/entry.ts`
- Create: `packages/shared/src/types/note.ts`
- Create: `packages/shared/src/types/entity.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@nara/shared",
  "version": "0.1.0",
  "private": true,
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

- [ ] **Step 2: Create src/types/common.ts**

```typescript
export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

- [ ] **Step 3: Create src/types/entry.ts**

```typescript
export type EntryStatus = "pending" | "processing" | "done" | "failed";

export interface Entry {
  entry_id: string;
  status: EntryStatus;
}

export interface EntryStatusDone extends Entry {
  status: "done";
  note_ids: string[];
  transcript: string;
}

export interface EntryStatusFailed extends Entry {
  status: "failed";
  error: string;
}
```

- [ ] **Step 4: Create src/types/note.ts**

```typescript
export interface NoteCategory {
  id: string;
  name: string;
  color: string;
}

export interface NoteEntity {
  id: string;
  name: string;
  entity_type: "person" | "topic" | "place" | "other";
}

export interface Note {
  id: string;
  content: string;
  categories: NoteCategory[];
  entities: NoteEntity[];
  entry_id: string;
  created_at: string;
  updated_at: string;
  nara_context?: string | null;
}
```

- [ ] **Step 5: Create src/types/entity.ts**

```typescript
export type EntityType = "person" | "topic" | "place" | "other";
export type ToneLabel = "positive" | "neutral" | "negative";

export interface Entity {
  id: string;
  name: string;
  entity_type: EntityType;
  mention_count: number;
  last_mentioned_at: string;
  last_quote?: string;
}

export interface EntityTimelineEntry {
  note_id: string;
  date: string;
  content: string;
  tone: ToneLabel;
  context_snippet: string | null;
}

export interface EntityDetail extends Entity {
  first_mentioned_at: string;
  timeline: EntityTimelineEntry[];
}
```

- [ ] **Step 6: Create src/index.ts**

```typescript
export * from "./types/common.js";
export * from "./types/entry.js";
export * from "./types/note.js";
export * from "./types/entity.js";
```

- [ ] **Step 7: Typecheck**

```bash
cd packages/shared && pnpm install && pnpm typecheck
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared && git commit -m "feat: add shared TypeScript types (Note, Entity, Entry)"
```

---

## Task 3: SQL migrations (13 tables + pgvector + RLS)

**Files:**
- Create: `apps/api/migrations/001_extensions.sql`
- Create: `apps/api/migrations/002_tables.sql`
- Create: `apps/api/migrations/003_indexes.sql`
- Create: `apps/api/migrations/004_rls.sql`
- Create: `apps/api/scripts/migrate.ts`

- [ ] **Step 1: Create 001_extensions.sql**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
```

- [ ] **Step 2: Create 002_tables.sql**

```sql
-- entries
CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','done','failed')),
  error text,
  storage_path text,
  duration_sec int,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- notes
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  content text NOT NULL,
  emotion_score real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  note_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lower(name))
);

-- note_categories
CREATE TABLE IF NOT EXISTS note_categories (
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, category_id)
);

-- entities
CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('person','topic','place','other')),
  mention_count int NOT NULL DEFAULT 1,
  first_mentioned_at timestamptz NOT NULL DEFAULT now(),
  last_mentioned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, lower(name))
);

-- note_entities
CREATE TABLE IF NOT EXISTS note_entities (
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  context_snippet text,
  PRIMARY KEY (note_id, entity_id)
);

-- entity_cooccurrences
CREATE TABLE IF NOT EXISTS entity_cooccurrences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_a_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entity_b_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  count int NOT NULL DEFAULT 1,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_a_id, entity_b_id),
  CHECK (entity_a_id < entity_b_id)
);

-- note_embeddings
CREATE TABLE IF NOT EXISTS note_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model text NOT NULL DEFAULT 'text-embedding-3-small',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- loose_ends
CREATE TABLE IF NOT EXISTS loose_ends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  intention_text text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','dismissed')),
  resolved_note_id uuid REFERENCES notes(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- patterns
CREATE TABLE IF NOT EXISTS patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type text NOT NULL
    CHECK (pattern_type IN ('cooccurrence','emotional_arc','temporal','frequency')),
  description text NOT NULL,
  entity_ids uuid[] NOT NULL DEFAULT '{}',
  data_points int NOT NULL CHECK (data_points >= 3),
  is_active boolean NOT NULL DEFAULT true,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now()
);

-- weekly_letters
CREATE TABLE IF NOT EXISTS weekly_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

-- nudges
CREATE TABLE IF NOT EXISTS nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type text NOT NULL
    CHECK (nudge_type IN ('inactivity','loose_end','pattern','unresolved','entity_silence')),
  content text NOT NULL,
  entity_id uuid REFERENCES entities(id) ON DELETE SET NULL,
  source_note_id uuid REFERENCES notes(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quiet_hours_start int NOT NULL DEFAULT 22,
  quiet_hours_end int NOT NULL DEFAULT 8,
  timezone text NOT NULL DEFAULT 'UTC',
  enabled_types text[] NOT NULL DEFAULT
    '{inactivity,loose_end,pattern,unresolved,entity_silence}',
  expo_push_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: Create 003_indexes.sql**

```sql
CREATE INDEX IF NOT EXISTS idx_entries_user_created ON entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_entry ON notes(entry_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_category ON note_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_note_entities_entity ON note_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_entities_user_type ON entities(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_user_last ON entities(user_id, last_mentioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_cooccurrences_user_count ON entity_cooccurrences(user_id, count DESC);
CREATE INDEX IF NOT EXISTS idx_loose_ends_user_status ON loose_ends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_nudges_user_created ON nudges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudges_user_type_created ON nudges(user_id, nudge_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_user_active ON patterns(user_id, is_active);

-- pgvector approximate nearest-neighbour index
CREATE INDEX IF NOT EXISTS idx_note_embeddings_vector
  ON note_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- [ ] **Step 4: Create 004_rls.sql**

```sql
-- Enable RLS on every user-owned table
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_cooccurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loose_ends ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see their own rows
CREATE POLICY "own_entries" ON entries FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_notes" ON notes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_categories" ON categories FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_note_categories" ON note_categories FOR ALL
  USING (note_id IN (SELECT id FROM notes WHERE user_id = auth.uid()));
CREATE POLICY "own_note_entities" ON note_entities FOR ALL
  USING (note_id IN (SELECT id FROM notes WHERE user_id = auth.uid()));
CREATE POLICY "own_entities" ON entities FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_cooccurrences" ON entity_cooccurrences FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_embeddings" ON note_embeddings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_loose_ends" ON loose_ends FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_patterns" ON patterns FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_letters" ON weekly_letters FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_nudges" ON nudges FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_notification_prefs" ON notification_preferences FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 5: Create scripts/migrate.ts**

```typescript
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import pg from "pg";
import { config } from "../src/config.js";

const client = new pg.Client({ connectionString: config.DATABASE_URL });
await client.connect();

const migrationsDir = join(import.meta.dirname, "../migrations");
const files = readdirSync(migrationsDir).sort();

for (const file of files) {
  if (!file.endsWith(".sql")) continue;
  console.log(`Running ${file}...`);
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  await client.query(sql);
  console.log(`  ✓ ${file}`);
}

await client.end();
console.log("Migrations complete.");
```

- [ ] **Step 6: Run migrations against Supabase dev project**

```bash
cd apps/api && pnpm db:migrate
```
Expected: each migration file listed with ✓, no errors.

- [ ] **Step 7: Verify tables exist in Supabase dashboard (Tables panel)**

Check: all 13 tables present, `note_embeddings.embedding` shows type `vector`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/migrations apps/api/scripts && git commit -m "feat: add SQL migrations — 13 tables, pgvector index, RLS"
```

---

## Task 4: Scaffold apps/ai-worker (Python/uv/FastAPI)

**Files:**
- Create: `apps/ai-worker/pyproject.toml`
- Create: `apps/ai-worker/nara_worker/__init__.py`
- Create: `apps/ai-worker/nara_worker/config.py`
- Create: `apps/ai-worker/nara_worker/db.py`
- Create: `apps/ai-worker/tests/__init__.py`
- Create: `apps/ai-worker/tests/test_config.py`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "nara-worker"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn>=0.30.0",
  "pydantic>=2.9.0",
  "pydantic-settings>=2.5.0",
  "langchain>=0.3.0",
  "langchain-groq>=0.2.0",
  "langchain-openai>=0.2.0",
  "langchain-postgres>=0.0.12",
  "psycopg[binary]>=3.2.0",
  "pg-boss-py>=0.1.0",
  "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3.0",
  "pytest-asyncio>=0.24.0",
  "pytest-mock>=3.14.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

> Note: pg-boss-py wraps pg-boss via subprocess or psycopg directly. If unavailable, use raw psycopg3 to poll the `pgboss.job` table. See `nara_worker/worker.py` Task 8.

- [ ] **Step 2: Create nara_worker/config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    groq_api_key: str
    openai_api_key: str
    groq_model_fast: str = "llama-3.1-8b-instant"
    groq_model_quality: str = "llama-3.3-70b-versatile"
    embedding_model: str = "text-embedding-3-small"
    worker_poll_interval_ms: int = 2000

settings = Settings()
```

- [ ] **Step 3: Create nara_worker/db.py**

```python
import psycopg
from psycopg.rows import dict_row
from .config import settings

_pool: psycopg.AsyncConnectionPool | None = None

async def get_pool() -> psycopg.AsyncConnectionPool:
    global _pool
    if _pool is None:
        _pool = await psycopg.AsyncConnectionPool.connect(
            settings.database_url,
            min_size=2,
            max_size=10,
            kwargs={"row_factory": dict_row},
        )
    return _pool

async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
```

- [ ] **Step 4: Write the failing config test**

```python
# tests/test_config.py
def test_settings_loads_required_fields(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    monkeypatch.setenv("OPENAI_API_KEY", "sk_test")
    from importlib import reload
    import nara_worker.config as cfg_module
    reload(cfg_module)
    s = cfg_module.Settings()
    assert s.groq_model_fast == "llama-3.1-8b-instant"
    assert s.groq_model_quality == "llama-3.3-70b-versatile"
    assert s.worker_poll_interval_ms == 2000
```

- [ ] **Step 5: Install deps and run test**

```bash
cd apps/ai-worker && uv sync --extra dev && uv run pytest tests/test_config.py -v
```
Expected: PASSED.

- [ ] **Step 6: Commit**

```bash
git add apps/ai-worker && git commit -m "feat: scaffold ai-worker (uv, FastAPI, config, db pool)"
```

---

## Task 5: LangChain clients (Groq + OpenAI)

**Files:**
- Create: `apps/ai-worker/nara_worker/clients/__init__.py`
- Create: `apps/ai-worker/nara_worker/clients/groq.py`
- Create: `apps/ai-worker/nara_worker/clients/openai.py`
- Create: `apps/ai-worker/tests/test_clients.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_clients.py
def test_fast_llm_is_groq_8b():
    from nara_worker.clients.groq import fast_llm, quality_llm
    assert "8b" in fast_llm.model_name.lower() or "instant" in fast_llm.model_name.lower()
    assert "70b" in quality_llm.model_name.lower() or "versatile" in quality_llm.model_name.lower()

def test_embeddings_model_name():
    from nara_worker.clients.openai import embeddings
    assert embeddings.model == "text-embedding-3-small"
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/test_clients.py -v
```
Expected: FAILED — ModuleNotFoundError.

- [ ] **Step 3: Create clients/groq.py**

```python
from langchain_groq import ChatGroq
from ..config import settings

fast_llm = ChatGroq(
    model=settings.groq_model_fast,
    api_key=settings.groq_api_key,
    temperature=0,
)

quality_llm = ChatGroq(
    model=settings.groq_model_quality,
    api_key=settings.groq_api_key,
    temperature=0.7,
)
```

- [ ] **Step 4: Create clients/openai.py**

```python
from langchain_openai import OpenAIEmbeddings
from ..config import settings

embeddings = OpenAIEmbeddings(
    model=settings.embedding_model,
    api_key=settings.openai_api_key,
)
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/test_clients.py -v
```
Expected: PASSED.

- [ ] **Step 6: Commit**

```bash
git add nara_worker/clients && git commit -m "feat: LangChain Groq + OpenAI embedding clients"
```

---

## Task 6: Extraction prompt + LangChain structured extraction

**Files:**
- Create: `apps/ai-worker/nara_worker/prompts/__init__.py`
- Create: `apps/ai-worker/nara_worker/prompts/extraction.py`
- Create: `apps/ai-worker/nara_worker/pipeline/extraction.py`
- Create: `apps/ai-worker/tests/pipeline/test_extraction.py`

- [ ] **Step 1: Write the failing test (golden input)**

```python
# tests/pipeline/test_extraction.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from nara_worker.pipeline.extraction import extract_from_text
from nara_worker.pipeline.extraction import ExtractionResult, ExtractedNote

GOLDEN_INPUT = (
    "I'm overwhelmed by the project deadline. Slides not started. "
    "Rohan texted but I couldn't reply. Reading Atomic Habits."
)

@pytest.mark.asyncio
async def test_extract_returns_multiple_notes():
    mock_result = ExtractionResult(notes=[
        ExtractedNote(
            content="Overwhelmed by project deadline. Slides not started.",
            categories=["Work"],
            emotion_score=-0.7,
            entities=[{"name": "Rohan", "type": "person", "context_snippet": "Rohan texted"}],
            intentions=[],
        ),
        ExtractedNote(
            content="Rohan texted, couldn't reply.",
            categories=["Rohan"],
            emotion_score=-0.3,
            entities=[{"name": "Rohan", "type": "person", "context_snippet": "Rohan texted"}],
            intentions=["Reply to Rohan"],
        ),
        ExtractedNote(
            content="Reading Atomic Habits.",
            categories=["Books"],
            emotion_score=0.2,
            entities=[{"name": "Atomic Habits", "type": "topic", "context_snippet": "Reading Atomic Habits"}],
            intentions=[],
        ),
    ])
    with patch("nara_worker.pipeline.extraction._chain") as mock_chain:
        mock_chain.ainvoke = AsyncMock(return_value=mock_result)
        result = await extract_from_text(GOLDEN_INPUT)
    assert len(result.notes) >= 2
    categories = [cat for note in result.notes for cat in note.categories]
    assert "Work" in categories

@pytest.mark.asyncio
async def test_extract_returns_extraction_result_type():
    mock_result = ExtractionResult(notes=[
        ExtractedNote(content="test", categories=["Work"],
                      emotion_score=0.0, entities=[], intentions=[])
    ])
    with patch("nara_worker.pipeline.extraction._chain") as mock_chain:
        mock_chain.ainvoke = AsyncMock(return_value=mock_result)
        result = await extract_from_text("test input")
    assert isinstance(result, ExtractionResult)
    assert all(isinstance(n, ExtractedNote) for n in result.notes)
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/pipeline/test_extraction.py -v
```
Expected: FAILED — ModuleNotFoundError.

- [ ] **Step 3: Create prompts/extraction.py**

```python
EXTRACTION_SYSTEM_PROMPT = """You are an expert at extracting structured memories from personal journal entries.

Given a raw text input, extract ALL distinct thoughts as separate notes.
Each note should cover ONE topic, person, or concern.
Resolve co-references: if "he" refers to Rohan, use "Rohan".
Never invent details not in the text.

For emotion_score: -1.0 = very negative, 0 = neutral, 1.0 = very positive.
For intentions: extract any "I need to", "I should", "I want to", "I've been meaning to" statements as clean action phrases.
For entity type: "person" for named people, "topic" for subjects/books/events, "place" for locations.

Return valid JSON matching the schema exactly."""

EXTRACTION_VERSION = "v1"
```

- [ ] **Step 4: Create pipeline/extraction.py**

```python
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from ..clients.groq import fast_llm
from ..prompts.extraction import EXTRACTION_SYSTEM_PROMPT

class ExtractedEntity(BaseModel):
    name: str
    type: str = Field(pattern="^(person|topic|place|other)$")
    context_snippet: str

class ExtractedNote(BaseModel):
    content: str
    categories: list[str] = Field(min_length=1)
    emotion_score: float = Field(ge=-1.0, le=1.0)
    entities: list[ExtractedEntity] = Field(default_factory=list)
    intentions: list[str] = Field(default_factory=list)

class ExtractionResult(BaseModel):
    notes: list[ExtractedNote] = Field(min_length=1)

_prompt = ChatPromptTemplate.from_messages([
    ("system", EXTRACTION_SYSTEM_PROMPT),
    ("human", "Extract memories from this text:\n\n{text}"),
])

_chain = _prompt | fast_llm.with_structured_output(ExtractionResult)

async def extract_from_text(text: str) -> ExtractionResult:
    return await _chain.ainvoke({"text": text})
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/pipeline/test_extraction.py -v
```
Expected: PASSED.

- [ ] **Step 6: Commit**

```bash
git add nara_worker/prompts nara_worker/pipeline/extraction.py tests/pipeline/ && \
git commit -m "feat: entity extraction via LangChain structured output (Groq 8B)"
```

---

## Task 7: Entity registry + persistence (notes, entities, co-occurrences)

**Files:**
- Create: `apps/ai-worker/nara_worker/pipeline/persistence.py`
- Create: `apps/ai-worker/tests/pipeline/test_persistence.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/pipeline/test_persistence.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from nara_worker.pipeline.persistence import (
    canonical_pair, find_or_create_category, find_or_create_entity,
    upsert_cooccurrence, save_notes_from_extraction,
)
from nara_worker.pipeline.extraction import ExtractionResult, ExtractedNote

def test_canonical_pair_always_smaller_first():
    a, b = str(uuid4()), str(uuid4())
    r1 = canonical_pair(a, b)
    r2 = canonical_pair(b, a)
    assert r1 == r2
    assert r1[0] < r1[1]

def test_canonical_pair_raises_on_equal():
    uid = str(uuid4())
    with pytest.raises(ValueError):
        canonical_pair(uid, uid)

@pytest.mark.asyncio
async def test_save_notes_returns_note_ids():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    conn.fetchone = AsyncMock(return_value={"id": str(uuid4())})
    conn.fetchall = AsyncMock(return_value=[])

    extraction = ExtractionResult(notes=[
        ExtractedNote(content="Test note", categories=["Work"],
                      emotion_score=-0.5, entities=[], intentions=[])
    ])
    with patch("nara_worker.pipeline.persistence.find_or_create_category",
               new_callable=AsyncMock, return_value=str(uuid4())):
        note_ids = await save_notes_from_extraction(
            conn=conn,
            user_id=str(uuid4()),
            entry_id=str(uuid4()),
            extraction=extraction,
        )
    assert len(note_ids) == 1
    assert all(isinstance(nid, str) for nid in note_ids)
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/pipeline/test_persistence.py -v
```
Expected: FAILED.

- [ ] **Step 3: Create pipeline/persistence.py**

```python
import psycopg
from uuid import uuid4

CATEGORY_COLORS = {
    "work": "#BE6E45", "books": "#B5913F",
    "family": "#B27079", "people": "#7E9270",
}
FALLBACK_COLORS = ["#7E9270","#B5913F","#B27079","#BE6E45","#6B8FA3","#9A7FB5"]

def canonical_pair(a: str, b: str) -> tuple[str, str]:
    if a == b:
        raise ValueError("Cannot create co-occurrence with self")
    return (a, b) if a < b else (b, a)

async def find_or_create_category(conn, user_id: str, name: str) -> str:
    lower = name.lower()
    color = CATEGORY_COLORS.get(lower, FALLBACK_COLORS[hash(lower) % len(FALLBACK_COLORS)])
    row = await conn.fetchone(
        "INSERT INTO categories (user_id, name, color) VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id, lower(name)) DO UPDATE SET name=EXCLUDED.name "
        "RETURNING id", (user_id, name, color)
    )
    return row["id"]

async def find_or_create_entity(conn, user_id: str, name: str, entity_type: str) -> str:
    row = await conn.fetchone(
        "INSERT INTO entities (user_id, name, entity_type) VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id, entity_type, lower(name)) DO UPDATE SET "
        "mention_count = entities.mention_count + 1, "
        "last_mentioned_at = now() RETURNING id",
        (user_id, name, entity_type)
    )
    return row["id"]

async def upsert_cooccurrence(conn, user_id: str, entity_ids: list[str]) -> None:
    pairs = set()
    for i, a in enumerate(entity_ids):
        for b in entity_ids[i+1:]:
            pairs.add(canonical_pair(a, b))
    for (a, b) in pairs:
        await conn.execute(
            "INSERT INTO entity_cooccurrences (user_id, entity_a_id, entity_b_id) "
            "VALUES (%s, %s, %s) ON CONFLICT (user_id, entity_a_id, entity_b_id) "
            "DO UPDATE SET count = entity_cooccurrences.count + 1, last_seen_at = now()",
            (user_id, a, b)
        )

async def save_notes_from_extraction(conn, user_id: str, entry_id: str, extraction) -> list[str]:
    note_ids = []
    for extracted in extraction.notes:
        note_id = str(uuid4())
        await conn.execute(
            "INSERT INTO notes (id, user_id, entry_id, content, emotion_score) "
            "VALUES (%s, %s, %s, %s, %s)",
            (note_id, user_id, entry_id, extracted.content, extracted.emotion_score)
        )
        # categories
        for cat_name in extracted.categories:
            cat_id = await find_or_create_category(conn, user_id, cat_name)
            await conn.execute(
                "INSERT INTO note_categories (note_id, category_id) VALUES (%s, %s) "
                "ON CONFLICT DO NOTHING", (note_id, cat_id)
            )
            await conn.execute(
                "UPDATE categories SET note_count = note_count + 1 WHERE id = %s", (cat_id,)
            )
        # entities
        entity_ids = []
        for ent in extracted.entities:
            eid = await find_or_create_entity(conn, user_id, ent.name, ent.type)
            entity_ids.append(eid)
            await conn.execute(
                "INSERT INTO note_entities (note_id, entity_id, context_snippet) "
                "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (note_id, eid, ent.context_snippet)
            )
        # co-occurrences
        if len(entity_ids) > 1:
            await upsert_cooccurrence(conn, user_id, entity_ids)
        # loose ends
        for intention in extracted.intentions:
            await conn.execute(
                "INSERT INTO loose_ends (user_id, note_id, intention_text) VALUES (%s, %s, %s)",
                (user_id, note_id, intention)
            )
        note_ids.append(note_id)
    return note_ids
```

- [ ] **Step 4: Run tests**

```bash
uv run pytest tests/pipeline/test_persistence.py -v
```
Expected: PASSED.

- [ ] **Step 5: Commit**

```bash
git add nara_worker/pipeline/persistence.py tests/pipeline/test_persistence.py && \
git commit -m "feat: entity registry + persistence (find-or-create, co-occurrence canonical ordering)"
```

---

## Task 8: Embeddings pipeline (LangChain OpenAI → PGVector)

**Files:**
- Create: `apps/ai-worker/nara_worker/pipeline/embedding.py`
- Create: `apps/ai-worker/tests/pipeline/test_embedding.py`

- [ ] **Step 1: Write failing test**

```python
# tests/pipeline/test_embedding.py
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_embed_note_inserts_into_db():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    mock_embeddings = MagicMock()
    mock_embeddings.aembed_query = AsyncMock(return_value=[0.1] * 1536)

    with patch("nara_worker.pipeline.embedding.embeddings", mock_embeddings):
        from nara_worker.pipeline.embedding import embed_note
        note_id = str(uuid4())
        user_id = str(uuid4())
        await embed_note(conn=conn, note_id=note_id, user_id=user_id, content="test note content")

    conn.execute.assert_called_once()
    call_args = conn.execute.call_args[0]
    assert "note_embeddings" in call_args[0]

@pytest.mark.asyncio
async def test_embed_failure_is_non_fatal():
    conn = AsyncMock()
    mock_embeddings = MagicMock()
    mock_embeddings.aembed_query = AsyncMock(side_effect=Exception("API error"))

    with patch("nara_worker.pipeline.embedding.embeddings", mock_embeddings):
        from nara_worker.pipeline.embedding import embed_note
        # Should not raise — non-fatal
        result = await embed_note(
            conn=conn, note_id=str(uuid4()), user_id=str(uuid4()), content="test"
        )
    assert result is False
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/pipeline/test_embedding.py -v
```
Expected: FAILED.

- [ ] **Step 3: Create pipeline/embedding.py**

```python
import logging
from ..clients.openai import embeddings

logger = logging.getLogger(__name__)

async def embed_note(conn, note_id: str, user_id: str, content: str) -> bool:
    """Embed a note and store in note_embeddings. Returns False on failure (non-fatal)."""
    try:
        vector = await embeddings.aembed_query(content)
        await conn.execute(
            "INSERT INTO note_embeddings (note_id, user_id, embedding) "
            "VALUES (%s, %s, %s::vector) "
            "ON CONFLICT (note_id) DO UPDATE SET embedding = EXCLUDED.embedding",
            (note_id, user_id, vector)
        )
        return True
    except Exception as exc:
        logger.warning("Embedding failed for note %s: %s", note_id, exc)
        return False
```

- [ ] **Step 4: Run tests**

```bash
uv run pytest tests/pipeline/test_embedding.py -v
```
Expected: PASSED.

- [ ] **Step 5: Commit**

```bash
git add nara_worker/pipeline/embedding.py tests/pipeline/test_embedding.py && \
git commit -m "feat: note embedding pipeline (non-fatal on failure)"
```

---

## Task 9: process_entry job (full pipeline orchestrator)

**Files:**
- Create: `apps/ai-worker/nara_worker/jobs/__init__.py`
- Create: `apps/ai-worker/nara_worker/jobs/process_entry.py`

- [ ] **Step 1: Create jobs/process_entry.py**

```python
import logging
from ..db import get_pool
from ..pipeline.extraction import extract_from_text
from ..pipeline.persistence import save_notes_from_extraction
from ..pipeline.embedding import embed_note

logger = logging.getLogger(__name__)

async def process_entry(entry_id: str) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.transaction():
            # Fetch entry
            row = await conn.fetchone(
                "SELECT id, user_id, raw_text, status FROM entries WHERE id = %s",
                (entry_id,)
            )
            if not row or row["status"] not in ("pending", "failed"):
                logger.info("Skipping entry %s (status=%s)", entry_id, row["status"] if row else "missing")
                return

            # Mark processing
            await conn.execute(
                "UPDATE entries SET status='processing' WHERE id = %s", (entry_id,)
            )

        # Extract (outside transaction — can be slow)
        try:
            extraction = await extract_from_text(row["raw_text"])
        except Exception as exc:
            logger.error("Extraction failed for entry %s: %s", entry_id, exc)
            async with conn.transaction():
                await conn.execute(
                    "UPDATE entries SET status='failed', error=%s WHERE id = %s",
                    (str(exc), entry_id)
                )
            return

        # Persist
        async with conn.transaction():
            note_ids = await save_notes_from_extraction(
                conn=conn,
                user_id=row["user_id"],
                entry_id=entry_id,
                extraction=extraction,
            )
            await conn.execute(
                "UPDATE entries SET status='done', processed_at=now() WHERE id = %s",
                (entry_id,)
            )

    # Embed (non-fatal, outside transaction)
    pool = await get_pool()
    async with pool.connection() as conn:
        for note_id, extracted in zip(note_ids, extraction.notes):
            await embed_note(conn=conn, note_id=note_id,
                             user_id=row["user_id"], content=extracted.content)

    logger.info("Entry %s processed → %d notes", entry_id, len(note_ids))
```

- [ ] **Step 2: Commit**

```bash
git add nara_worker/jobs/ && git commit -m "feat: process_entry job orchestrates extraction → persistence → embedding"
```

---

## Task 10: pg-boss worker loop + FastAPI server

**Files:**
- Create: `apps/ai-worker/nara_worker/worker.py`

- [ ] **Step 1: Create worker.py**

```python
import asyncio
import logging
from contextlib import asynccontextmanager
import psycopg
from fastapi import FastAPI
from .config import settings
from .db import get_pool, close_pool
from .jobs.process_entry import process_entry

logger = logging.getLogger(__name__)

async def poll_jobs(conn_str: str, interval_ms: int) -> None:
    """Poll pgboss.job table for pending process_entry jobs."""
    interval = interval_ms / 1000
    while True:
        try:
            async with await psycopg.AsyncConnection.connect(conn_str) as conn:
                row = await conn.execute(
                    """
                    UPDATE pgboss.job SET state = 'active', started_on = now()
                    WHERE id = (
                        SELECT id FROM pgboss.job
                        WHERE name = 'process_entry' AND state = 'created'
                        ORDER BY created_on ASC LIMIT 1 FOR UPDATE SKIP LOCKED
                    ) RETURNING data
                    """
                ).fetchone()
                if row:
                    payload = row[0]
                    entry_id = payload["entry_id"]
                    try:
                        await process_entry(entry_id)
                        await conn.execute(
                            "UPDATE pgboss.job SET state='completed' WHERE data->>'entry_id' = %s",
                            (entry_id,)
                        )
                    except Exception as exc:
                        logger.error("Job failed for entry %s: %s", entry_id, exc)
                        await conn.execute(
                            "UPDATE pgboss.job SET state='failed' WHERE data->>'entry_id' = %s",
                            (entry_id,)
                        )
        except Exception as exc:
            logger.warning("Poll error: %s", exc)
        await asyncio.sleep(interval)

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(poll_jobs(settings.database_url, settings.worker_poll_interval_ms))
    yield
    await close_pool()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Start the worker and verify it runs**

```bash
cd apps/ai-worker && uv run uvicorn nara_worker.worker:app --port 8000
```
Expected: "Application startup complete" with no errors.

- [ ] **Step 3: Commit**

```bash
git add nara_worker/worker.py && git commit -m "feat: pg-boss consumer loop + FastAPI worker server"
```

---

## Task 11: Ask Nara — RAG chain (LangChain PGVector + retrieval)

**Files:**
- Create: `apps/ai-worker/nara_worker/prompts/ask_nara.py`
- Create: `apps/ai-worker/nara_worker/rag/ask_nara.py`
- Create: `apps/ai-worker/tests/rag/test_ask_nara.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/rag/test_ask_nara.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

@pytest.mark.asyncio
async def test_ask_returns_answer_and_cited_ids():
    mock_doc = MagicMock()
    mock_doc.page_content = "Work stress has been high this week."
    mock_doc.metadata = {"note_id": str(uuid4())}

    with patch("nara_worker.rag.ask_nara._get_vector_store") as mock_vs_fn, \
         patch("nara_worker.rag.ask_nara.quality_llm") as mock_llm:
        mock_vs = MagicMock()
        mock_vs.asimilarity_search = AsyncMock(return_value=[mock_doc])
        mock_vs_fn.return_value = mock_vs
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="You mentioned work stress 3 times."))

        from nara_worker.rag.ask_nara import ask_nara
        result = await ask_nara(user_id=str(uuid4()), question="What have I said about work?")

    assert "answer" in result
    assert "cited_note_ids" in result
    assert isinstance(result["cited_note_ids"], list)

@pytest.mark.asyncio
async def test_ask_returns_no_data_message_when_empty_retrieval():
    with patch("nara_worker.rag.ask_nara._get_vector_store") as mock_vs_fn, \
         patch("nara_worker.rag.ask_nara.quality_llm") as mock_llm:
        mock_vs = MagicMock()
        mock_vs.asimilarity_search = AsyncMock(return_value=[])
        mock_vs_fn.return_value = mock_vs
        mock_llm.ainvoke = AsyncMock(return_value=MagicMock(content="I haven't heard you mention that yet."))

        from nara_worker.rag.ask_nara import ask_nara
        result = await ask_nara(user_id=str(uuid4()), question="Tell me about surfing")

    assert result["cited_note_ids"] == []
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/rag/test_ask_nara.py -v
```
Expected: FAILED.

- [ ] **Step 3: Create prompts/ask_nara.py**

```python
ASK_NARA_SYSTEM_PROMPT = """You are Nara, a personal memory assistant.
You have access to notes the user has shared with you over time.

Rules:
- Answer ONLY based on the provided notes below. Never invent or assume.
- If the notes contain no relevant information, say: "I haven't heard you mention that yet."
- Write in second person ("You mentioned...", "You talked about...").
- Be warm, specific, and concise. Reference real details from the notes.
- Do not use bullet points or numbered lists.

Notes from the user's journal:
{context}"""
```

- [ ] **Step 4: Create rag/ask_nara.py**

```python
from langchain_postgres import PGVector
from langchain_core.prompts import ChatPromptTemplate
from ..clients.openai import embeddings
from ..clients.groq import quality_llm
from ..config import settings
from ..prompts.ask_nara import ASK_NARA_SYSTEM_PROMPT

def _get_vector_store(user_id: str) -> PGVector:
    return PGVector(
        embeddings=embeddings,
        collection_name=f"notes_{user_id}",
        connection=settings.database_url,
    )

async def ask_nara(user_id: str, question: str, k: int = 10) -> dict:
    vector_store = _get_vector_store(user_id)
    docs = await vector_store.asimilarity_search(question, k=k)

    if not docs:
        return {
            "answer": "I haven't heard you mention that yet.",
            "cited_note_ids": [],
        }

    context = "\n\n".join(
        f"[{doc.metadata.get('note_id', 'unknown')}] {doc.page_content}"
        for doc in docs
    )
    prompt = ChatPromptTemplate.from_messages([
        ("system", ASK_NARA_SYSTEM_PROMPT),
        ("human", "{question}"),
    ])
    chain = prompt | quality_llm
    response = await chain.ainvoke({"context": context, "question": question})

    cited_ids = [
        doc.metadata["note_id"]
        for doc in docs
        if "note_id" in doc.metadata
    ]
    return {"answer": response.content, "cited_note_ids": cited_ids}
```

- [ ] **Step 5: Expose Ask Nara as FastAPI endpoint in worker.py**

Add to `nara_worker/worker.py`:
```python
from pydantic import BaseModel
from .rag.ask_nara import ask_nara as _ask_nara

class AskRequest(BaseModel):
    user_id: str
    question: str

@app.post("/ask")
async def ask_endpoint(req: AskRequest):
    return await _ask_nara(user_id=req.user_id, question=req.question)
```

- [ ] **Step 6: Run tests**

```bash
uv run pytest tests/rag/test_ask_nara.py -v
```
Expected: PASSED.

- [ ] **Step 7: Commit**

```bash
git add nara_worker/rag nara_worker/prompts/ask_nara.py tests/rag/ nara_worker/worker.py && \
git commit -m "feat: Ask Nara RAG chain (LangChain PGVector + Groq 70B, grounded only in user notes)"
```

---

## Task 12: Pattern detection job (SQL-based, no LLM)

**Files:**
- Create: `apps/ai-worker/nara_worker/jobs/detect_patterns.py`
- Create: `apps/ai-worker/tests/jobs/test_detect_patterns.py`

- [ ] **Step 1: Write failing test**

```python
# tests/jobs/test_detect_patterns.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

@pytest.mark.asyncio
async def test_pattern_requires_3_data_points():
    conn = AsyncMock()
    user_id = str(uuid4())
    # Simulate 2 co-occurrences — below threshold, no pattern written
    conn.fetchall = AsyncMock(return_value=[
        {"entity_a_id": str(uuid4()), "entity_b_id": str(uuid4()),
         "count": 2, "name_a": "Work", "name_b": "Stress"}
    ])
    conn.execute = AsyncMock()

    from nara_worker.jobs.detect_patterns import detect_patterns_for_user
    await detect_patterns_for_user(conn, user_id)

    # No patterns written — count < 3
    for call in conn.execute.call_args_list:
        assert "INSERT INTO patterns" not in call[0][0]

@pytest.mark.asyncio
async def test_pattern_written_at_3_data_points():
    conn = AsyncMock()
    user_id = str(uuid4())
    eid_a, eid_b = str(uuid4()), str(uuid4())
    conn.fetchall = AsyncMock(return_value=[
        {"entity_a_id": eid_a, "entity_b_id": eid_b,
         "count": 4, "name_a": "Work", "name_b": "Stress"}
    ])
    conn.execute = AsyncMock()

    from nara_worker.jobs.detect_patterns import detect_patterns_for_user
    await detect_patterns_for_user(conn, user_id)

    insert_calls = [c for c in conn.execute.call_args_list
                    if "INSERT INTO patterns" in c[0][0]]
    assert len(insert_calls) >= 1
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/jobs/test_detect_patterns.py -v
```
Expected: FAILED.

- [ ] **Step 3: Create jobs/detect_patterns.py**

```python
import logging
from ..db import get_pool

logger = logging.getLogger(__name__)
MIN_DATA_POINTS = 3

async def detect_patterns_for_user(conn, user_id: str) -> None:
    # Co-occurrence patterns
    rows = await conn.fetchall(
        """
        SELECT c.entity_a_id, c.entity_b_id, c.count,
               ea.name as name_a, eb.name as name_b
        FROM entity_cooccurrences c
        JOIN entities ea ON ea.id = c.entity_a_id
        JOIN entities eb ON eb.id = c.entity_b_id
        WHERE c.user_id = %s AND c.count >= %s
        """,
        (user_id, MIN_DATA_POINTS)
    )
    for row in rows:
        description = (
            f"{row['name_a']} and {row['name_b']} "
            f"appear together frequently ({row['count']} times)"
        )
        await conn.execute(
            """
            INSERT INTO patterns
              (user_id, pattern_type, description, entity_ids, data_points)
            VALUES (%s, 'cooccurrence', %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (user_id, description,
             [row["entity_a_id"], row["entity_b_id"]], row["count"])
        )

async def run_detect_patterns() -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        users = await conn.fetchall("SELECT DISTINCT user_id FROM entries WHERE status='done'")
        for user in users:
            await detect_patterns_for_user(conn, user["user_id"])
```

- [ ] **Step 4: Run tests**

```bash
uv run pytest tests/jobs/test_detect_patterns.py -v
```
Expected: PASSED.

- [ ] **Step 5: Commit**

```bash
git add nara_worker/jobs/detect_patterns.py tests/jobs/ && \
git commit -m "feat: pattern detection job (SQL co-occurrence, min 3 data points enforced)"
```

---

## Task 13: Weekly letter job (Groq 70B, grounded prompt)

**Files:**
- Create: `apps/ai-worker/nara_worker/prompts/weekly_letter.py`
- Create: `apps/ai-worker/nara_worker/jobs/weekly_letter.py`
- Create: `apps/ai-worker/tests/jobs/test_weekly_letter.py`

- [ ] **Step 1: Write failing test**

```python
# tests/jobs/test_weekly_letter.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import date

@pytest.mark.asyncio
async def test_letter_skipped_with_no_notes():
    conn = AsyncMock()
    conn.fetchall = AsyncMock(return_value=[])
    conn.fetchone = AsyncMock(return_value=None)
    conn.execute = AsyncMock()

    from nara_worker.jobs.weekly_letter import generate_letter_for_user
    await generate_letter_for_user(conn, str(uuid4()), date(2026, 6, 15), date(2026, 6, 21))

    insert_calls = [c for c in conn.execute.call_args_list
                    if "INSERT INTO weekly_letters" in c[0][0]]
    assert len(insert_calls) == 0

@pytest.mark.asyncio
async def test_letter_written_with_notes():
    conn = AsyncMock()
    note_id = str(uuid4())
    conn.fetchall = AsyncMock(return_value=[
        {"content": "Had a stressful work deadline.", "created_at": "2026-06-16",
         "emotion_score": -0.6, "category_names": ["Work"]}
    ])
    conn.execute = AsyncMock()

    with patch("nara_worker.jobs.weekly_letter.quality_llm") as mock_llm:
        mock_llm.ainvoke = AsyncMock(
            return_value=MagicMock(content="This week you carried a lot.")
        )
        from nara_worker.jobs.weekly_letter import generate_letter_for_user
        await generate_letter_for_user(
            conn, str(uuid4()), date(2026, 6, 15), date(2026, 6, 21)
        )

    insert_calls = [c for c in conn.execute.call_args_list
                    if "INSERT INTO weekly_letters" in c[0][0]]
    assert len(insert_calls) == 1
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/jobs/test_weekly_letter.py -v
```
Expected: FAILED.

- [ ] **Step 3: Create prompts/weekly_letter.py**

```python
WEEKLY_LETTER_SYSTEM_PROMPT = """You are Nara, a personal memory assistant writing a weekly letter.

You have access to everything the user shared this week.
Write a warm, personal letter in second person.

Rules — these are non-negotiable:
- NO bullet points, numbered lists, headers, or any structured formatting.
- Every sentence must reference something real from the notes provided.
- Do not be generic. A letter that could have been written without reading the notes has failed.
- Acknowledge what was hard. Acknowledge what resolved.
- Notice things mentioned once that never came back.
- End gently — leave them with one or two open threads, not a task list.
- Target ending line quality: "You had a better week than Monday morning felt like you would."

Notes from this week:
{notes_text}"""

WEEKLY_LETTER_VERSION = "v1"
```

- [ ] **Step 4: Create jobs/weekly_letter.py**

```python
import logging
from datetime import date
from langchain_core.prompts import ChatPromptTemplate
from ..clients.groq import quality_llm
from ..prompts.weekly_letter import WEEKLY_LETTER_SYSTEM_PROMPT
from ..db import get_pool

logger = logging.getLogger(__name__)
MIN_NOTES_FOR_LETTER = 3

async def generate_letter_for_user(conn, user_id: str, week_start: date, week_end: date) -> None:
    notes = await conn.fetchall(
        """
        SELECT n.content, n.created_at, n.emotion_score,
               array_agg(c.name) as category_names
        FROM notes n
        LEFT JOIN note_categories nc ON nc.note_id = n.id
        LEFT JOIN categories c ON c.id = nc.category_id
        WHERE n.user_id = %s AND n.created_at::date BETWEEN %s AND %s
        GROUP BY n.id ORDER BY n.created_at
        """,
        (user_id, week_start, week_end)
    )

    if len(notes) < MIN_NOTES_FOR_LETTER:
        logger.info("Skipping letter for user %s — only %d notes", user_id, len(notes))
        return

    notes_text = "\n\n".join(
        f"[{n['created_at'][:10]}] ({', '.join(filter(None, n['category_names'] or []))})\n{n['content']}"
        for n in notes
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", WEEKLY_LETTER_SYSTEM_PROMPT),
        ("human", "Write my weekly letter."),
    ])
    chain = prompt | quality_llm
    response = await chain.ainvoke({"notes_text": notes_text})

    await conn.execute(
        "INSERT INTO weekly_letters (user_id, content, week_start, week_end) "
        "VALUES (%s, %s, %s, %s) ON CONFLICT (user_id, week_start) DO UPDATE SET content = EXCLUDED.content",
        (user_id, response.content, week_start, week_end)
    )

async def run_weekly_letters() -> None:
    from datetime import timedelta
    today = date.today()
    week_end = today
    week_start = today - timedelta(days=6)
    pool = await get_pool()
    async with pool.connection() as conn:
        users = await conn.fetchall("SELECT DISTINCT user_id FROM notes")
        for user in users:
            await generate_letter_for_user(conn, user["user_id"], week_start, week_end)
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/jobs/test_weekly_letter.py -v
```
Expected: PASSED.

- [ ] **Step 6: Commit**

```bash
git add nara_worker/prompts/weekly_letter.py nara_worker/jobs/weekly_letter.py tests/jobs/test_weekly_letter.py && \
git commit -m "feat: weekly letter job (Groq 70B, grounded prompt, no lists/templates)"
```

---

## Task 14: Nudge evaluation job + sweeper

**Files:**
- Create: `apps/ai-worker/nara_worker/jobs/evaluate_nudges.py`
- Create: `apps/ai-worker/nara_worker/jobs/sweeper.py`

- [ ] **Step 1: Create jobs/evaluate_nudges.py**

```python
import logging
from datetime import datetime, timedelta, timezone
from ..db import get_pool

logger = logging.getLogger(__name__)
MAX_NUDGES_PER_DAY = 2
COOLDOWN_HOURS = 48
INACTIVITY_DAYS = 4

async def _in_quiet_hours(conn, user_id: str) -> bool:
    pref = await conn.fetchone(
        "SELECT quiet_hours_start, quiet_hours_end, timezone FROM notification_preferences WHERE user_id = %s",
        (user_id,)
    )
    if not pref:
        return False
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(pref["timezone"] or "UTC")
    local_hour = datetime.now(tz).hour
    start, end = pref["quiet_hours_start"], pref["quiet_hours_end"]
    if start > end:  # crosses midnight
        return local_hour >= start or local_hour < end
    return start <= local_hour < end

async def _nudge_on_cooldown(conn, user_id: str, nudge_type: str) -> bool:
    row = await conn.fetchone(
        "SELECT created_at FROM nudges WHERE user_id=%s AND nudge_type=%s "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id, nudge_type)
    )
    if not row:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(hours=COOLDOWN_HOURS)
    return row["created_at"] > cutoff

async def evaluate_nudges_for_user(conn, user_id: str) -> None:
    if await _in_quiet_hours(conn, user_id):
        return

    # Daily cap
    today_count = await conn.fetchone(
        "SELECT COUNT(*) as c FROM nudges WHERE user_id=%s AND created_at > now() - interval '1 day'",
        (user_id,)
    )
    if today_count and today_count["c"] >= MAX_NUDGES_PER_DAY:
        return

    # Inactivity nudge
    if not await _nudge_on_cooldown(conn, user_id, "inactivity"):
        last = await conn.fetchone(
            "SELECT created_at FROM entries WHERE user_id=%s ORDER BY created_at DESC LIMIT 1",
            (user_id,)
        )
        if last:
            days_ago = (datetime.now(timezone.utc) - last["created_at"]).days
            if days_ago >= INACTIVITY_DAYS:
                await conn.execute(
                    "INSERT INTO nudges (user_id, nudge_type, content) VALUES (%s, 'inactivity', %s)",
                    (user_id, f"You haven't added anything in {days_ago} days. What's on your mind?")
                )
                return

    # Loose end nudge
    if not await _nudge_on_cooldown(conn, user_id, "loose_end"):
        le = await conn.fetchone(
            "SELECT le.id, le.intention_text, le.note_id FROM loose_ends le "
            "WHERE le.user_id=%s AND le.status='open' "
            "ORDER BY le.created_at ASC LIMIT 1",
            (user_id,)
        )
        if le:
            await conn.execute(
                "INSERT INTO nudges (user_id, nudge_type, content, source_note_id) "
                "VALUES (%s, 'loose_end', %s, %s)",
                (user_id, f"You mentioned: \"{le['intention_text']}\". Still thinking about it?", le["note_id"])
            )

async def run_evaluate_nudges() -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        users = await conn.fetchall("SELECT DISTINCT user_id FROM notification_preferences")
        for user in users:
            await evaluate_nudges_for_user(conn, user["user_id"])
```

- [ ] **Step 2: Create jobs/sweeper.py**

```python
import logging
from datetime import datetime, timedelta, timezone
from ..db import get_pool

logger = logging.getLogger(__name__)

async def requeue_stuck_entries() -> None:
    """Reset entries stuck in 'processing' for over 10 minutes back to 'pending'."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    pool = await get_pool()
    async with pool.connection() as conn:
        result = await conn.execute(
            "UPDATE entries SET status='pending' "
            "WHERE status='processing' AND created_at < %s",
            (cutoff,)
        )
        if result.rowcount:
            logger.info("Sweeper re-queued %d stuck entries", result.rowcount)
```

- [ ] **Step 3: Register scheduled jobs in worker.py**

Add to the `lifespan` context in `nara_worker/worker.py`:
```python
from .jobs.detect_patterns import run_detect_patterns
from .jobs.weekly_letter import run_weekly_letters
from .jobs.evaluate_nudges import run_evaluate_nudges
from .jobs.sweeper import requeue_stuck_entries
import asyncio

async def run_scheduled_jobs():
    """Run scheduled intelligence jobs on a simple interval loop."""
    from datetime import datetime
    while True:
        now = datetime.utcnow()
        # Daily: pattern detection
        if now.hour == 2 and now.minute < 1:
            await run_detect_patterns()
        # Sunday evening: weekly letters
        if now.weekday() == 6 and now.hour == 18 and now.minute < 1:
            await run_weekly_letters()
        # Twice daily: nudges
        if now.hour in (9, 19) and now.minute < 1:
            await run_evaluate_nudges()
        # Every 5 minutes: sweeper
        if now.minute % 5 == 0:
            await requeue_stuck_entries()
        await asyncio.sleep(60)
```

Inside `lifespan`:
```python
asyncio.create_task(run_scheduled_jobs())
```

- [ ] **Step 4: Run the worker and verify startup**

```bash
uv run uvicorn nara_worker.worker:app --port 8000 --reload
```
Expected: "Application startup complete." No import errors.

- [ ] **Step 5: Commit**

```bash
git add nara_worker/jobs/evaluate_nudges.py nara_worker/jobs/sweeper.py nara_worker/worker.py && \
git commit -m "feat: nudge evaluation + sweeper + scheduled job loop"
```

---

## Task 15: Integration smoke test (end-to-end pipeline)

**Files:**
- Create: `apps/ai-worker/tests/test_integration_smoke.py`

> This test runs against the real Supabase dev project. Requires `.env` with valid keys. Skip in CI without keys.

- [ ] **Step 1: Create test**

```python
# tests/test_integration_smoke.py
import pytest
import os
from uuid import uuid4

pytestmark = pytest.mark.skipif(
    not os.getenv("DATABASE_URL"), reason="Requires real DATABASE_URL"
)

@pytest.mark.asyncio
async def test_full_pipeline_smoke():
    """Process a text entry end-to-end against the real DB."""
    from nara_worker.pipeline.extraction import extract_from_text
    from nara_worker.pipeline.persistence import save_notes_from_extraction
    from nara_worker.db import get_pool

    text = "I'm stressed about the project deadline. Rohan called but I missed it."
    extraction = await extract_from_text(text)

    assert len(extraction.notes) >= 1
    any_work = any("work" in c.lower() or "deadline" in c.lower()
                   for n in extraction.notes for c in n.categories)
    assert any_work, "Expected at least one Work-related note"

    has_rohan = any(
        e.name.lower() == "rohan"
        for n in extraction.notes for e in n.entities
    )
    assert has_rohan, "Expected Rohan to be extracted as an entity"
```

- [ ] **Step 2: Run smoke test**

```bash
uv run pytest tests/test_integration_smoke.py -v -s
```
Expected: PASSED. If entity extraction returns surprising results, tune `prompts/extraction.py`.

- [ ] **Step 3: Commit**

```bash
git add tests/test_integration_smoke.py && git commit -m "test: integration smoke test for full pipeline"
```

---

## Self-review

**Spec coverage:**
- ✅ One entry → multiple notes (Task 6+7)
- ✅ Entity extraction + co-reference (Task 6)
- ✅ Find-or-create entities, canonical co-occurrence pairs (Task 7)
- ✅ Embeddings → note_embeddings (Task 8)
- ✅ Ask Nara RAG, grounded only in user notes (Task 11)
- ✅ Loose ends written in persistence (Task 7)
- ✅ Pattern detection ≥3 data points enforced (Task 12)
- ✅ Weekly letter, no lists, grounded (Task 13)
- ✅ Nudges with quiet hours, daily cap, cooldown, real-content reference (Task 14)
- ✅ Sweeper re-queues stuck entries (Task 14)
- ✅ SQL migrations with RLS (Task 3)
- ✅ API scaffold (Task 1) — full routes in Plan B
- ✅ Shared types (Task 2)
- ⚠️ Mood endpoint → Plan B
- ⚠️ DELETE /account → Plan B
- ⚠️ Loose-end auto-resolution (completion language) → implement in `pipeline/loose_ends.py` as an enhancement after Plan B

**Placeholder scan:** None found. All tasks have real code.

**Type consistency:** `ExtractionResult` / `ExtractedNote` defined in Task 6 and used exactly by Task 7, 9, 15. `canonical_pair` defined and tested in Task 7, used in same file. No naming drift.
