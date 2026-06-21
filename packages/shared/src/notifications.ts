import type { NudgeType } from './common.js';

/**
 * Notification preferences. Source: docs/API_CONTRACT.md § Notifications.
 */
export interface NotificationPreferences {
  quiet_hours_start: number; // local hour 0-23
  quiet_hours_end: number; // local hour 0-23
  timezone: string; // IANA tz
  enabled_types: NudgeType[];
}

/** PUT /notifications/preferences — all fields optional (partial update). */
export interface UpdateNotificationPreferencesRequest {
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  timezone?: string;
  enabled_types?: NudgeType[];
  /** Phase 2/3. */
  expo_push_token?: string;
}
