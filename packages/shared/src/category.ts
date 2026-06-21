import type { UUID } from './common.js';
import type { Note } from './note.js';

/**
 * Category = per-user emergent bucket. Source: docs/API_CONTRACT.md § Categories.
 */
export interface Category {
  id: UUID;
  name: string;
  color: string;
  note_count: number;
}

export interface CategoriesListResponse {
  categories: Category[];
}

/** GET /categories/:id/notes */
export interface CategoryNotesResponse {
  category: Pick<Category, 'id' | 'name' | 'color'>;
  notes: Note[];
  next_cursor: string | null;
}
