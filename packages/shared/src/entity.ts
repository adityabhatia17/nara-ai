import type { EntityType, ISODateTime, UUID } from './common.js';
import type { EntityTimelineItem } from './note.js';

/**
 * Entity = a node in the user's memory graph. Source: docs/API_CONTRACT.md § Entities.
 */
export interface EntityListItem {
  id: UUID;
  name: string;
  entity_type: EntityType;
  mention_count: number;
  last_mentioned_at: ISODateTime;
  /** First line of the most recent note mentioning this entity. */
  last_quote: string | null;
}

export interface EntitiesListResponse {
  entities: EntityListItem[];
}

/** GET /entities/:id — full per-entity timeline (Person Detail screen). */
export interface Entity {
  id: UUID;
  name: string;
  entity_type: EntityType;
  mention_count: number;
  first_mentioned_at: ISODateTime;
  last_mentioned_at: ISODateTime;
  timeline: EntityTimelineItem[];
}
