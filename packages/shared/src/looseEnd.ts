import type { ISODateTime, UUID } from './common.js';

/**
 * LooseEnd = an auto-detected intention. GET /loose-ends returns only open ones.
 * Source: docs/API_CONTRACT.md § Loose Ends.
 */
export interface LooseEnd {
  id: UUID;
  intention_text: string;
  created_at: ISODateTime;
  source_note_id: UUID;
  status: 'open';
}

export interface LooseEndsListResponse {
  loose_ends: LooseEnd[];
}

export interface DismissLooseEndResponse {
  dismissed: true;
}
