import type { ISODate, ISODateTime, MoodBucket } from './common.js';

/**
 * Mood = observations & trends ONLY — never raw scores (Rule #8).
 * Source: docs/API_CONTRACT.md § Mood.
 */
export interface MoodDailyPoint {
  date: ISODate;
  /** null when too little data that day. */
  tone: MoodBucket | null;
}

export interface MoodResponse {
  range: { from: ISODateTime; to: ISODateTime };
  daily: MoodDailyPoint[];
  /** Only patterns with >=3 data points (Rule #3). */
  observations: string[];
  week_over_week: string;
}
