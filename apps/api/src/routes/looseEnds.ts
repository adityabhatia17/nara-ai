import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { sendError } from "../lib/errors.js";

const looseEndsRoutes: FastifyPluginAsync = async (app) => {
  // GET /loose-ends — returns open items only
  app.get("/loose-ends", async (request) => {
    const userId = request.user.id;
    const { rows } = await pool.query(
      `SELECT le.id, le.intention_text, le.created_at,
              le.note_id AS source_note_id, le.status
       FROM loose_ends le
       WHERE le.user_id = $1 AND le.status = 'open'
       ORDER BY le.created_at ASC`,
      [userId]
    );
    return { loose_ends: rows };
  });

  // DELETE /loose-ends/:id — dismiss
  app.delete<{ Params: { id: string } }>("/loose-ends/:id", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const { rowCount } = await pool.query(
      `UPDATE loose_ends
       SET status = 'dismissed', resolved_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'open'`,
      [id, userId]
    );
    if (rowCount === 0) return sendError(reply, 404, "not_found", "Loose end not found or already dismissed");

    return { dismissed: true };
  });
};

export default looseEndsRoutes;
