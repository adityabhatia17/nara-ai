import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { sendError } from "../lib/errors.js";

function scoreToTone(score: number | null): "positive" | "neutral" | "negative" {
  if (score === null || score === undefined) return "neutral";
  if (score >= 0.3) return "positive";
  if (score <= -0.3) return "negative";
  return "neutral";
}

const entitiesRoutes: FastifyPluginAsync = async (app) => {
  // GET /entities
  app.get<{ Querystring: { type?: string } }>("/entities", async (request) => {
    const userId = request.user.id;
    const { type } = request.query;

    const params: unknown[] = [userId];
    const typeFilter = type ? `AND e.entity_type = $2` : "";
    if (type) params.push(type);

    // last_quote = first line of most recent note mentioning this entity
    const { rows } = await pool.query(
      `SELECT
         e.id, e.name, e.entity_type, e.mention_count, e.last_mentioned_at,
         (SELECT LEFT(n.content, 120)
          FROM note_entities ne2
          JOIN notes n ON n.id = ne2.note_id
          WHERE ne2.entity_id = e.id AND n.user_id = $1
          ORDER BY n.created_at DESC LIMIT 1) AS last_quote
       FROM entities e
       WHERE e.user_id = $1 ${typeFilter}
       ORDER BY e.last_mentioned_at DESC`,
      params
    );

    return { entities: rows };
  });

  // GET /entities/:id
  app.get<{ Params: { id: string } }>("/entities/:id", async (request, reply) => {
    const userId = request.user.id;
    const { id } = request.params;

    const { rows: entityRows } = await pool.query(
      `SELECT id, name, entity_type, mention_count, first_mentioned_at, last_mentioned_at
       FROM entities WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (entityRows.length === 0) return sendError(reply, 404, "not_found", "Entity not found");

    const { rows: timelineRows } = await pool.query(
      `SELECT
         n.id AS note_id,
         n.created_at AS date,
         n.content,
         n.emotion_score,
         ne.context_snippet
       FROM note_entities ne
       JOIN notes n ON n.id = ne.note_id
       WHERE ne.entity_id = $1 AND n.user_id = $2
       ORDER BY n.created_at DESC`,
      [id, userId]
    );

    const timeline = timelineRows.map((row) => ({
      note_id: row.note_id,
      date: row.date,
      content: row.content,
      tone: scoreToTone(row.emotion_score), // emotion_score → tone label, score dropped
      context_snippet: row.context_snippet,
    }));

    return { ...entityRows[0], timeline };
  });
};

export default entitiesRoutes;
