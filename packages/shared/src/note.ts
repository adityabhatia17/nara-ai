import type { EntityType, ISODateTime, Tone, UUID } from './common.js';

/**
 * The canonical Note object used everywhere a note is returned.
 * IMPORTANT: there is NO emotion_score field, ever (Rule #8).
 * Source: docs/API_CONTRACT.md § Notes.
 */
export interface NoteCategoryRef {
  id: UUID;
  name: string;
  color: string;
}

export interface NoteEntityRef {
  id: UUID;
  name: string;
  entity_type: EntityType;
}

export interface Note {
  id: UUID;
  content: string;
  categories: NoteCategoryRef[];
  entities: NoteEntityRef[];
  entry_id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** GET /notes/:id returns a Note plus the optional context box text. */
export interface NoteDetail extends Note {
  nara_context: string | null;
}

export interface NotesListResponse {
  notes: Note[];
  next_cursor: string | null;
}

/** POST /notes/:id/append */
export interface AppendNoteRequest {
  text: string;
}

/** PUT /notes/:id */
export interface UpdateNoteRequest {
  content: string;
}

export interface DeleteNoteResponse {
  deleted: true;
}

/** A single row in an entity timeline (GET /entities/:id). */
export interface EntityTimelineItem {
  note_id: UUID;
  date: ISODateTime;
  content: string;
  tone: Tone;
  context_snippet: string | null;
}
