import type { UUID } from './common.js';

/**
 * Ask Nara (RAG). Grounded only in the user's notes (Rule #9).
 * Source: docs/API_CONTRACT.md § Ask Nara.
 */
export interface AskRequest {
  question: string;
}

export interface AskResponse {
  answer: string;
  cited_note_ids: UUID[];
}

/** The exact refusal string returned when retrieval is empty (Rule #9). */
export const ASK_EMPTY_RETRIEVAL_ANSWER = "I haven't heard you mention that yet.";
