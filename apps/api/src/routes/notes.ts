import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { sendError } from "../lib/errors.js";
import { encodeCursor, decodeCursor } from "../lib/cursor.js";
import { enqueueReprocessNote } from "../lib/queue.js";

// SQL fragment that builds the full Note shape (no emotion_score)
const NOTE_SELECT = `
  SELECT
    n.id,
    n.content,
    n.entry_id,
    n.created_at,
    n.updated_at,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color))
        FILTER (WHERE c.id IS NOT NULL), '[]'
    ) AS categories,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', e.id, 'name', e.name, 'entity_type', e.entity_type))
        FILTER (WHERE e.id IS NOT NULL), '[]'
    ) AS entities
  FROM notes n
  LEFT JOIN note_categories nc ON nc.note_id = n.id
  LEFT JOIN categories c ON c.id = nc.category_id
  LEFT JOIN note_entities ne ON ne.note_id = n.id
  LEFT JOIN entities e ON e.id = ne.entity_id
`;

function toneFromScore(score: number | null): "positive" | "neutral" | "negative" {
  if (score === null || score === undefined) return "neutral";
  if (score >= 0.3) return "positive";
  if (score <= -0.3) return "negative";
  return "neutral";
}

const notesRoutes: FastifyPluginAsync = async (app) => {
  // GET /notes — paginated feed with filters
  app.get<{
    Querystring: {
      limit?: string;
      cursor?: string;
      category_id?: string;
      entity_id?: string;
      from?: string;
      to?: string;
      tone?: "positive" | "negative";
    };
  }>("/notes", async (request, reply) => {
    const userId = request.user.id;
    const { limit: limitStr, cursor, category_id, entity_id, from, to, tone } = request.query;
    const limit = Math.min(Number(limitStr ?? 20), 50);
    const cursorDate = cursor ? decodeCursor(cursor) : null;

    const conditions: string[] = ["n.user_id = $1"];
    const params: unknown[] = [userId];
    let p = 2;

    if (cursorDate) { conditions.push(`n.created_at < $${p++}`); params.push(cursorDate); }
    if (category_id) { conditions.push(`nc.category_id = $${p++}`); params.push(category_id); }
    if (entity_id) { conditions.push(`ne.entity_id = $${p++}`); params.push(entity_id); }
    if (from) { conditions.push(`n.created_at >= $${p++}`); params.push(from); }
    if (to) { conditions.push(`n.created_at <= $${p++}`); params.push(to); }
    // tone filter: map to emotion_score range (score stays server-side)
    if (tone === "positive") { conditions.push(`n.emotion_score >= 0.3`); }
    if (tone === "negative") { conditions.push(`n.emotion_score <= -0.3`); }

    params.push(limit + 1);
    const { rows } = await pool.query(
      `${NOTE_SELECT}
       WHERE ${conditions.join(" AND ")}
       GROUP BY n.id
       ORDER BY n.created_at DESC
       LIMIT $${p}`,
      params
    );

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1].created_at) : null;

    return { notes: rows, next_cursor: nextCursor };
  });

  // GET /notes/:id
  app.get<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const { rows } = await pool.query(
      `${NOTE_SELECT}
       WHERE n.id = $1 AND n.user_id = $2
       GROUP BY n.id`,
      [id, userId]
    );

    if (rows.length === 0) return sendError(reply, 404, "not_found", "Note not found");

    return { ...rows[0], nara_context: null };
  });

  // POST /notes/:id/append
  app.post<{
    Params: { id: string };
    Body: { text: string };
  }>("/notes/:id/append", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;
    const { text } = request.body ?? {};

    if (!text?.trim()) {
      return sendError(reply, 422, "unprocessable", "text is required");
    }

    const { rows } = await pool.query(
      "SELECT id, content FROM notes WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (rows.length === 0) return sendError(reply, 404, "not_found", "Note not found");

    const newContent = rows[0].content + "\n\n" + text.trim();
    await pool.query(
      "UPDATE notes SET content = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
      [newContent, id, userId]
    );

    try {
      await enqueueReprocessNote(id);
    } catch (err) {
      request.log.error({ err }, "failed to enqueue reprocess_note");
    }

    const { rows: updated } = await pool.query(
      `${NOTE_SELECT} WHERE n.id = $1 AND n.user_id = $2 GROUP BY n.id`,
      [id, userId]
    );
    return { ...updated[0], nara_context: null };
  });

  // PUT /notes/:id — edit full content
  app.put<{
    Params: { id: string };
    Body: { content: string };
  }>("/notes/:id", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;
    const { content } = request.body ?? {};

    if (!content?.trim()) {
      return sendError(reply, 422, "unprocessable", "content is required");
    }

    const { rowCount } = await pool.query(
      "UPDATE notes SET content = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
      [content.trim(), id, userId]
    );
    if (rowCount === 0) return sendError(reply, 404, "not_found", "Note not found");

    try {
      await enqueueReprocessNote(id);
    } catch (err) {
      request.log.error({ err }, "failed to enqueue reprocess_note");
    }

    const { rows } = await pool.query(
      `${NOTE_SELECT} WHERE n.id = $1 AND n.user_id = $2 GROUP BY n.id`,
      [id, userId]
    );
    return { ...rows[0], nara_context: null };
  });

  // DELETE /notes/:id
  app.delete<{ Params: { id: string } }>("/notes/:id", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const { rowCount } = await pool.query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    if (rowCount === 0) return sendError(reply, 404, "not_found", "Note not found");

    return { deleted: true };
  });
};

export default notesRoutes;
