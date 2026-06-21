import type { UUID } from './common.js';

/**
 * pg-boss job names and payloads — the contract between the Node producer
 * (apps/api) and the Python consumer (apps/ai-worker). Source: CLAUDE_BACKEND.md §8.
 *
 * The Python worker mirrors these as pydantic models. Keep names + payload
 * shapes in lockstep across both sides.
 */

export const QUEUE = {
  PROCESS_ENTRY: 'process_entry',
  EMBED_NOTE: 'embed_note',
  DETECT_PATTERNS: 'detect_patterns',
  WEEKLY_LETTER: 'weekly_letter',
  EVALUATE_NUDGES: 'evaluate_nudges',
  STUCK_ENTRY_SWEEPER: 'stuck_entry_sweeper',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/** The post-entry pipeline. Idempotent on entryId (Rule #13). */
export interface ProcessEntryJob {
  entryId: UUID;
}

/** Re-embed a note whose embedding failed (non-fatal retry, Rule #14). */
export interface EmbedNoteJob {
  noteId: UUID;
}

export interface DetectPatternsJob {
  userId: UUID;
}

export interface WeeklyLetterJob {
  userId: UUID;
}

export interface EvaluateNudgesJob {
  userId: UUID;
}

/** Re-queue entries stuck in `processing` past a timeout. No payload. */
export type StuckEntrySweeperJob = Record<string, never>;

/** Maps each queue name to its payload type. */
export interface JobPayloads {
  [QUEUE.PROCESS_ENTRY]: ProcessEntryJob;
  [QUEUE.EMBED_NOTE]: EmbedNoteJob;
  [QUEUE.DETECT_PATTERNS]: DetectPatternsJob;
  [QUEUE.WEEKLY_LETTER]: WeeklyLetterJob;
  [QUEUE.EVALUATE_NUDGES]: EvaluateNudgesJob;
  [QUEUE.STUCK_ENTRY_SWEEPER]: StuckEntrySweeperJob;
}
