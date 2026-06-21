import type { ISODateTime, NudgeType, UUID } from './common.js';

/**
 * Nudge = a generated, content-grounded prompt (Rule #4).
 * Source: docs/API_CONTRACT.md § Nudges.
 */
export interface NudgeEntityRef {
  id: UUID;
  name: string;
}

export interface Nudge {
  id: UUID;
  nudge_type: NudgeType;
  content: string;
  entity: NudgeEntityRef | null;
  source_note_id: UUID | null;
  created_at: ISODateTime;
  dismissed_at: ISODateTime | null;
}

export interface NudgesListResponse {
  nudges: Nudge[];
}

export interface DismissNudgeResponse {
  dismissed: true;
}
