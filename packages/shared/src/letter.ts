import type { ISODate, ISODateTime, UUID } from './common.js';

/**
 * Weekly letter. Source: docs/API_CONTRACT.md § Weekly Letters.
 */

/** List item (GET /letters) — preview only, not the full body. */
export interface LetterListItem {
  id: UUID;
  week_start: ISODate;
  week_end: ISODate;
  preview: string;
  created_at: ISODateTime;
  delivered_at: ISODateTime | null;
}

export interface LettersListResponse {
  letters: LetterListItem[];
  next_cursor: string | null;
}

/** GET /letters/:id — the full letter. */
export interface Letter {
  id: UUID;
  content: string;
  week_start: ISODate;
  week_end: ISODate;
  created_at: ISODateTime;
  delivered_at: ISODateTime | null;
}
