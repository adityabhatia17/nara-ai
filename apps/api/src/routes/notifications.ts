import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";

const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /notifications/preferences
  app.get("/notifications/preferences", async (request) => {
    const userId = request.user.id;

    const { rows } = await pool.query(
      `SELECT quiet_hours_start, quiet_hours_end, timezone, enabled_types
       FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      // Return defaults
      return {
        quiet_hours_start: 22,
        quiet_hours_end: 8,
        timezone: "UTC",
        enabled_types: ["inactivity", "loose_end", "pattern", "unresolved", "entity_silence"],
      };
    }
    return rows[0];
  });

  // PUT /notifications/preferences
  app.put<{
    Body: {
      quiet_hours_start?: number;
      quiet_hours_end?: number;
      timezone?: string;
      enabled_types?: string[];
      expo_push_token?: string;
    };
  }>("/notifications/preferences", async (request) => {
    const userId = request.user.id;
    const { quiet_hours_start, quiet_hours_end, timezone, enabled_types, expo_push_token } =
      request.body ?? {};

    await pool.query(
      `INSERT INTO notification_preferences
         (user_id, quiet_hours_start, quiet_hours_end, timezone, enabled_types, expo_push_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         quiet_hours_start = COALESCE($2, notification_preferences.quiet_hours_start),
         quiet_hours_end   = COALESCE($3, notification_preferences.quiet_hours_end),
         timezone          = COALESCE($4, notification_preferences.timezone),
         enabled_types     = COALESCE($5, notification_preferences.enabled_types),
         expo_push_token   = COALESCE($6, notification_preferences.expo_push_token),
         updated_at        = now()`,
      [
        userId,
        quiet_hours_start ?? null,
        quiet_hours_end ?? null,
        timezone ?? null,
        enabled_types ?? null,
        expo_push_token ?? null,
      ]
    );

    const { rows } = await pool.query(
      `SELECT quiet_hours_start, quiet_hours_end, timezone, enabled_types
       FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    return rows[0];
  });
};

export default notificationsRoutes;
