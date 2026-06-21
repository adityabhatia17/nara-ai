# Nara — API Contract

**Status:** Binding contract. Last updated 2026-06-19.
**Base URL (dev):** `http://localhost:3000`
**Format:** REST / JSON. All bodies are `application/json` unless noted.

This is the binding contract between the Node API and the Frontend app. The Frontend
Agent builds against it exactly. **Any change after the Frontend Agent starts gets a
changelog entry at the bottom of this file.**

---

## Conventions

- **Auth:** every endpoint except `/auth/*` and `/health` requires
  `Authorization: Bearer <supabase_jwt>`. The API verifies the JWT against Supabase
  and derives `user_id`. There is **no** way to access another user's data (Rule #6).
- **IDs:** all ids are uuid strings.
- **Timestamps:** ISO 8601 strings (`2026-06-19T08:30:00Z`).
- **Pagination:** cursor-based. List endpoints accept `?limit=` (default 20, max 50)
  and `?cursor=` (opaque). Responses include `next_cursor` (null when no more).
- **Emotion scores are NEVER returned** (Rule #8). Mood is exposed only as
  observations/trends via `/mood`.
- **Errors:** consistent shape (see below). HTTP status reflects the class.

### Error shape
```json
{ "error": { "code": "string_code", "message": "human readable", "details": {} } }
```
| HTTP | code examples | meaning |
|------|---------------|---------|
| 400 | `validation_error` | bad/missing fields (`details` lists fields) |
| 401 | `unauthorized` | missing/invalid JWT |
| 403 | `forbidden` | authenticated but not allowed (should be rare; RLS-backed) |
| 404 | `not_found` | resource doesn't exist or isn't yours |
| 409 | `conflict` | e.g. duplicate |
| 422 | `unprocessable` | semantically invalid (e.g. text too long) |
| 429 | `rate_limited` | see Rate limits |
| 500 | `internal_error` | unexpected |
| 503 | `ai_unavailable` | upstream AI provider failing; retry later |

### Rate limits
Per-user token bucket. `POST /entries`: 30/hour. `POST /ask`: 60/hour. Others: 300/min.
`429` returns `Retry-After` header (seconds).

---

## Auth

### POST /auth/magic-link
Request a magic-link email (beta auth).
```
Body:   { "email": "priya@example.com" }
200:    { "sent": true }
```

### POST /auth/verify
Exchange a magic-link token for a session. (In practice the Supabase client SDK
handles this on-device; documented for completeness.)
```
Body:   { "token": "..." }
200:    { "access_token": "...", "refresh_token": "...", "user": { "id", "email" } }
401:    invalid/expired token
```

### GET /auth/me
```
200:    { "id", "email", "created_at", "display_name": "Priya" | null }
```

### DELETE /account
Permanently deletes the user and ALL their data (Rule #10). Irreversible.
```
200:    { "deleted": true }
```

---

## Entries (Phase 1: text in. Phase 2: audio.)

### POST /entries
Submit text; triggers async AI pipeline. Returns immediately.
```
Body:   { "text": "string (1..20000 chars)" }
202:    { "entry_id": "uuid", "status": "pending" }
422:    text empty or too long
429:    rate_limited
```
Phase 2 adds: `multipart/form-data` with an `audio` file (5s–30min); same 202 shape.

### GET /entries/:id/status
Client polls this (~every 1.5s) until terminal status.
```
200 (pending|processing):
        { "entry_id", "status": "pending" | "processing" }
200 (done):
        { "entry_id", "status": "done",
          "note_ids": ["uuid", ...],
          "transcript": "the text that was processed" }
200 (failed):
        { "entry_id", "status": "failed", "error": "human readable reason" }
404:    not yours / unknown
```
**Async contract:** `POST /entries` is the only async op. The client knows it's done
when this poll returns `status: "done"` with `note_ids`, then navigates to Reveal and
fetches those notes.

---

## Notes

### GET /notes
List notes with filters. Powers the Feed (time/category/people views).
```
Query:  ?limit, ?cursor
        &category_id=uuid        (filter to one category)
        &entity_id=uuid          (filter to notes mentioning an entity/person)
        &from=ISO&to=ISO         (date range)
        &tone=positive|negative  (derived direction; NOT a raw score filter)
        &group=time|category|person  (hint for client grouping; server returns flat list + group keys)
200:    { "notes": [ Note, ... ], "next_cursor": "..."|null }
```

**Note object** (the canonical shape used everywhere):
```json
{
  "id": "uuid",
  "content": "Overwhelmed about the project deadline. Slides not started.",
  "categories": [ { "id": "uuid", "name": "Work", "color": "#BE6E45" } ],
  "entities": [ { "id": "uuid", "name": "Rohan", "entity_type": "person" } ],
  "entry_id": "uuid",
  "created_at": "2026-06-19T08:47:00Z",
  "updated_at": "2026-06-19T08:47:00Z"
}
```
Note: **no emotion_score** field, ever.

### GET /notes/:id
```
200:    Note  (plus "nara_context": string|null — the light italic context box text)
404:    not found
```

### POST /notes/:id/append
Add to an existing note via text (Phase 1) or voice (Phase 2). Appended text is
re-run through extraction so entities/embeddings update.
```
Body:   { "text": "I think it was because I was distant." }
200:    Note (updated)
```

### PUT /notes/:id
Edit note text (user correction). Re-embeds; re-extracts entities for the new text.
```
Body:   { "content": "string" }
200:    Note (updated)
```

### DELETE /notes/:id
Deletes the note; cascades note_categories, note_entities, note_embeddings; decrements
category note_count and entity mention_count; recomputes affected co-occurrences.
```
200:    { "deleted": true }
```

---

## Entities & People

### GET /entities
```
Query:  ?type=person|topic|place|other  (optional)
200:    { "entities": [
          { "id", "name", "entity_type", "mention_count",
            "last_mentioned_at", "last_quote": "first line of most recent note" }
        ] }
```

### GET /entities/:id
Full timeline for one entity (Person Detail screen).
```
200:    {
          "id", "name", "entity_type", "mention_count",
          "first_mentioned_at", "last_mentioned_at",
          "timeline": [
            { "note_id", "date": "ISO", "content",
              "tone": "positive"|"neutral"|"negative",   // derived label, not a score
              "context_snippet": "..." }
          ]
        }
404:    not found
```
`tone` is a coarse derived label (from emotion_score bucketed), never the raw number.

---

## Categories

### GET /categories
```
200:    { "categories": [ { "id", "name", "color", "note_count" } ] }
```

### GET /categories/:id/notes
```
Query:  ?limit, ?cursor
200:    { "category": { "id", "name", "color" },
          "notes": [ Note, ... ], "next_cursor": null|"..." }
```

---

## Ask Nara

### POST /ask
Natural-language question over the user's own notes (RAG). Grounded only in their
notes (Rule #9).
```
Body:   { "question": "What have I been saying about work lately?" }
200:    {
          "answer": "In the last two weeks you mentioned work stress seven times...",
          "cited_note_ids": ["uuid", ...]
        }
200 (no relevant notes):
        { "answer": "I haven't heard you mention that yet.", "cited_note_ids": [] }
429:    rate_limited
503:    ai_unavailable
```
Synchronous (the chat UI waits with the dotBlink typing indicator). Typical 2–4s.

---

## Loose Ends

### GET /loose-ends
```
200:    { "loose_ends": [
          { "id", "intention_text", "created_at",
            "source_note_id", "status": "open" }
        ] }     // only status=open returned by default
```

### DELETE /loose-ends/:id
Manually dismiss (Rule #7). Sets status=dismissed.
```
200:    { "dismissed": true }
```

---

## Weekly Letters

### GET /letters
```
Query:  ?limit, ?cursor
200:    { "letters": [
          { "id", "week_start", "week_end", "preview": "first ~120 chars",
            "created_at", "delivered_at": ISO|null } ],
          "next_cursor": null|"..." }
```

### GET /letters/:id
```
200:    { "id", "content", "week_start", "week_end", "created_at", "delivered_at" }
404:    not found
```

---

## Mood

### GET /mood
Observations and trends only — never raw scores (Rule #8).
```
Query:  ?from=ISO&to=ISO   (default: last 30 days)
200:    {
          "range": { "from", "to" },
          "daily": [ { "date": "2026-06-19", "tone": "lighter"|"steady"|"heavier"|null } ],
          "observations": [
            "Your weeks tend to feel lighter on Wednesdays.",
            "Work notes carried a heavier tone than usual this week."
          ],
          "week_over_week": "This week felt steadier than last."
        }
```
`tone` per day is a coarse bucket label, `null` when too little data. `observations`
only include patterns with ≥3 data points (Rule #3).

---

## Notifications

### GET /notifications/preferences
```
200:    { "quiet_hours_start": 22, "quiet_hours_end": 8, "timezone": "Asia/Kolkata",
          "enabled_types": ["inactivity","loose_end","pattern","unresolved","entity_silence"] }
```

### PUT /notifications/preferences
```
Body:   { "quiet_hours_start"?: int, "quiet_hours_end"?: int,
          "timezone"?: "IANA", "enabled_types"?: [string],
          "expo_push_token"?: "string"  // Phase 2/3 }
200:    (the updated preferences object)
```

---

## Nudges (read model; generation is server-side)

### GET /nudges
For the Nudges overlay screen. Returns recent generated nudges.
```
Query:  ?limit (default 10)
200:    { "nudges": [
          { "id", "nudge_type", "content", "entity": {id,name}|null,
            "source_note_id": uuid|null, "created_at", "dismissed_at": null|ISO } ] }
```

### POST /nudges/:id/dismiss
```
200:    { "dismissed": true }
```

---

## Health

### GET /health
```
200:    { "status": "ok", "db": "up", "queue": "up" }
```

---

## Endpoint ↔ screen map (for the Frontend Agent)

| Screen | Endpoints |
|--------|-----------|
| Home | GET /auth/me, GET /notes?limit=2, GET /nudges?limit=1 |
| Listening → Processing | POST /entries |
| Processing → Reveal | GET /entries/:id/status (poll), GET /notes/:id ×N |
| Feed | GET /notes (group=time/category/person), GET /categories, GET /entities?type=person |
| Note Detail | GET /notes/:id, POST /notes/:id/append, PUT /notes/:id |
| Ask Nara | POST /ask |
| People | GET /entities?type=person |
| Person Detail | GET /entities/:id |
| Nudges overlay | GET /nudges, POST /nudges/:id/dismiss |
| (settings) | GET/PUT /notifications/preferences, DELETE /account |
| Weekly letter (deep link) | GET /letters, GET /letters/:id |

---

## Changelog
_(empty — no changes since freeze. Every post-freeze change appends here: date, what
changed, why, migration impact.)_
