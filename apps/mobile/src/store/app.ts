/**
 * Nara App Store
 * UI state management with Zustand.
 * Server state lives in TanStack Query; only transient UI lives here.
 */

import { create } from 'zustand';

export type RecordingState = 'idle' | 'listening' | 'processing';

export interface FeedFilters {
  view: 'time' | 'category' | 'person';
  categoryId?: string;
  entityId?: string;
  from?: string;
  to?: string;
}

interface AppStore {
  // Recording flow
  recordingState: RecordingState;
  recordingElapsed: number; // milliseconds
  setRecordingState: (state: RecordingState) => void;
  setRecordingElapsed: (ms: number) => void;

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
  recordingState: 'idle',
  recordingElapsed: 0,
  setRecordingState: (state) => set({ recordingState: state }),
  setRecordingElapsed: (ms) => set({ recordingElapsed: ms }),

  feedFilters: initialFeedFilters,
  setFeedFilters: (filters) =>
    set((state) => ({
      feedFilters: { ...state.feedFilters, ...filters },
    })),
  resetFeedFilters: () => set({ feedFilters: initialFeedFilters }),

  nudgesOpen: false,
  setNudgesOpen: (open) => set({ nudgesOpen: open }),
}));
