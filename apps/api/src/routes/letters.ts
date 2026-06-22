import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { sendError } from "../lib/errors.js";
import { encodeCursor, decodeCursor } from "../lib/cursor.js";

const lettersRoutes: FastifyPluginAsync = async (app) => {
  // GET /letters — paginated list
  app.get<{ Querystring: { limit?: string; cursor?: string } }>("/letters", async (request) => {
    const userId = request.user.id;
    const { limit: limitStr, cursor } = request.query;
    const limit = Math.min(Number(limitStr ?? 20), 50);
    const cursorDate = cursor ? decodeCursor(cursor) : null;

    const params: unknown[] = [userId];
    const cursorClause = cursorDate ? `AND created_at < $2` : "";
    if (cursorDate) params.push(cursorDate);
    params.push(limit + 1);

    const { rows } = await pool.query(
      `SELECT id, week_start, week_end,
              LEFT(content, 120) AS preview,
              created_at, delivered_at
       FROM weekly_letters
       WHERE user_id = $1 ${cursorClause}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1].created_at) : null;

    return { letters: rows, next_cursor: nextCursor };
  });

  // GET /letters/:id — full letter
  app.get<{ Params: { id: string } }>("/letters/:id", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const { rows } = await pool.query(
      `SELECT id, content, week_start, week_end, created_at, delivered_at
       FROM weekly_letters WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (rows.length === 0) return sendError(reply, 404, "not_found", "Letter not found");

    return rows[0];
  });
};

export default lettersRoutes;
