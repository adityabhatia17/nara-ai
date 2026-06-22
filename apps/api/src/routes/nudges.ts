import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { sendError } from "../lib/errors.js";

const nudgesRoutes: FastifyPluginAsync = async (app) => {
  // GET /nudges
  app.get<{ Querystring: { limit?: string } }>("/nudges", async (request) => {
    const userId = request.user.id;
    const limit = Math.min(Number(request.query.limit ?? 10), 50);

    const { rows } = await pool.query(
      `SELECT
         n.id, n.nudge_type, n.content, n.source_note_id, n.created_at, n.dismissed_at,
         CASE WHEN n.entity_id IS NOT NULL
              THEN jsonb_build_object('id', e.id, 'name', e.name)
              ELSE NULL END AS entity
       FROM nudges n
       LEFT JOIN entities e ON e.id = n.entity_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return { nudges: rows };
  });

  // POST /nudges/:id/dismiss
  app.post<{ Params: { id: string } }>("/nudges/:id/dismiss", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const { rowCount } = await pool.query(
      `UPDATE nudges SET dismissed_at = now()
       WHERE id = $1 AND user_id = $2 AND dismissed_at IS NULL`,
      [id, userId]
    );
    if (rowCount === 0) return sendError(reply, 404, "not_found", "Nudge not found or already dismissed");

    return { dismissed: true };
  });
};

export default nudgesRoutes;
