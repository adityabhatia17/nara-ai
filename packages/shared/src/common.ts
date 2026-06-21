/**
 * Shared primitive aliases and cross-cutting shapes.
 * Source of truth: docs/API_CONTRACT.md.
 */

/** A uuid string. */
export type UUID = string;

/** An ISO 8601 timestamp string, e.g. "2026-06-19T08:30:00Z". */
export type ISODateTime = string;

/** An ISO 8601 date string (no time), e.g. "2026-06-19". */
export type ISODate = string;

/** Coarse derived tone label. Never a raw emotion_score (Rule #8). */
export type Tone = 'positive' | 'neutral' | 'negative';

/** Direction filter accepted by GET /notes?tone= (Rule #8: never a raw score). */
export type ToneDirection = 'positive' | 'negative';

/** Per-day mood bucket label exposed by GET /mood (Rule #8). */
export type MoodBucket = 'lighter' | 'steady' | 'heavier';

export type EntityType = 'person' | 'topic' | 'place' | 'other';

export type EntryStatus = 'pending' | 'processing' | 'done' | 'failed';

export type LooseEndStatus = 'open' | 'resolved' | 'dismissed';

export type PatternType = 'cooccurrence' | 'emotional_arc' | 'temporal' | 'frequency';

export type NudgeType =
  | 'inactivity'
  | 'loose_end'
  | 'pattern'
  | 'unresolved'
  | 'entity_silence';

/** Cursor-paginated envelope: list endpoints return a flat list + opaque cursor. */
export interface Paginated<T> {
  next_cursor: string | null;
  items: T[];
}

/** Standard pagination query (?limit default 20, max 50; ?cursor opaque). */
export interface PaginationQuery {
  limit?: number;
  cursor?: string;
}
