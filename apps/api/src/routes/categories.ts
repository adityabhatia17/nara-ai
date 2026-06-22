import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { sendError } from "../lib/errors.js";
import { encodeCursor, decodeCursor } from "../lib/cursor.js";

const NOTE_SELECT = `
  SELECT
    n.id, n.content, n.entry_id, n.created_at, n.updated_at,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', c2.id, 'name', c2.name, 'color', c2.color))
        FILTER (WHERE c2.id IS NOT NULL), '[]'
    ) AS categories,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', e.id, 'name', e.name, 'entity_type', e.entity_type))
        FILTER (WHERE e.id IS NOT NULL), '[]'
    ) AS entities
  FROM notes n
  LEFT JOIN note_categories nc2 ON nc2.note_id = n.id
  LEFT JOIN categories c2 ON c2.id = nc2.category_id
  LEFT JOIN note_entities ne ON ne.note_id = n.id
  LEFT JOIN entities e ON e.id = ne.entity_id
`;

const categoriesRoutes: FastifyPluginAsync = async (app) => {
  // GET /categories
  app.get("/categories", async (request) => {
    const userId = request.user.id;
    const { rows } = await pool.query(
      `SELECT id, name, color, note_count FROM categories
       WHERE user_id = $1 ORDER BY note_count DESC`,
      [userId]
    );
    return { categories: rows };
  });

  // GET /categories/:id/notes
  app.get<{
    Params: { id: string };
    Querystring: { limit?: string; cursor?: string };
  }>("/categories/:id/notes", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;
    const { limit: limitStr, cursor } = request.query;
    const limit = Math.min(Number(limitStr ?? 20), 50);
    const cursorDate = cursor ? decodeCursor(cursor) : null;

    const { rows: catRows } = await pool.query(
      "SELECT id, name, color FROM categories WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (catRows.length === 0) return sendError(reply, 404, "not_found", "Category not found");

    const params: unknown[] = [userId, id];
    const cursorClause = cursorDate ? `AND n.created_at < $3` : "";
    if (cursorDate) params.push(cursorDate);
    params.push(limit + 1);

    const { rows } = await pool.query(
      `${NOTE_SELECT}
       JOIN note_categories nc ON nc.note_id = n.id
       WHERE n.user_id = $1 AND nc.category_id = $2 ${cursorClause}
       GROUP BY n.id
       ORDER BY n.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1].created_at) : null;

    return { category: catRows[0], notes: rows, next_cursor: nextCursor };
  });
};

export default categoriesRoutes;
