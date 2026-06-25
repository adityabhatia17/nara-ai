/**
 * TanStack Query Client Configuration
 * Handles server state caching, retries, stale time, and polling.
 *
 * staleTime  30s  — data refetches after 30 seconds in the background
 * gcTime     5min — unused queries stay in memory for 5 minutes
 * retry      2    — retries up to 2 times, but never on 401 (auth failure)
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: any) => {
        // Never retry auth errors — they require user action
        if (error?.status === 401) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
    mutations: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
    },
  },
});
