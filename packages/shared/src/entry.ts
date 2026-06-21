import type { EntryStatus, UUID } from './common.js';

/**
 * Entry = the raw input unit. Phase 1: text. Source: docs/API_CONTRACT.md § Entries.
 */

/** POST /entries */
export interface CreateEntryRequest {
  text: string;
}

/** 202 response from POST /entries. */
export interface CreateEntryResponse {
  entry_id: UUID;
  status: Extract<EntryStatus, 'pending'>;
}

/** GET /entries/:id/status — discriminated on `status`. */
export type EntryStatusResponse =
  | { entry_id: UUID; status: 'pending' | 'processing' }
  | { entry_id: UUID; status: 'done'; note_ids: UUID[]; transcript: string }
  | { entry_id: UUID; status: 'failed'; error: string };
