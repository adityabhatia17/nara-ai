/**
 * Nara App Store
 * UI state management with Zustand.
 * Server state lives in TanStack Query; only transient UI lives here.
 */

import { create } from 'zustand';

export interface FeedFilters {
  view: 'time' | 'category' | 'person';
  categoryId?: string;
  entityId?: string;
  from?: string;
  to?: string;
}

interface AppStore {
  // Feed filters
  feedFilters: FeedFilters;
  setFeedFilters: (filters: Partial<FeedFilters>) => void;
  resetFeedFilters: () => void;

  // Nudges modal
  nudgesOpen: boolean;
  setNudgesOpen: (open: boolean) => void;
}

const initialFeedFilters: FeedFilters = { view: 'time' };

export const useAppStore = create<AppStore>((set) => ({
  feedFilters: initialFeedFilters,
  setFeedFilters: (filters) =>
    set((state) => ({
      feedFilters: { ...state.feedFilters, ...filters },
    })),
  resetFeedFilters: () => set({ feedFilters: initialFeedFilters }),

  nudgesOpen: false,
  setNudgesOpen: (open) => set({ nudgesOpen: open }),
}));
