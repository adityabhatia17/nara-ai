import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db.js";
import { enqueueProcessEntry } from "../lib/queue.js";
import { sendError } from "../lib/errors.js";

const MAX_TEXT_LENGTH = 20000;

const entriesRoutes: FastifyPluginAsync = async (app) => {
  // POST /entries — submit text, enqueue processing
  app.post<{ Body: { text: string } }>(
    "/entries",
    async (request, reply) => {
      const { text } = request.body ?? {};
      if (
        !text ||
        typeof text !== "string" ||
        text.trim().length === 0
      ) {
        return sendError(
          reply,
          422,
          "unprocessable",
          "text is required and must be non-empty"
        );
      }
      if (text.length > MAX_TEXT_LENGTH) {
        return sendError(
          reply,
          422,
          "unprocessable",
          `text must be ${MAX_TEXT_LENGTH} characters or fewer`
        );
      }

      const userId = request.user.id;
      const { rows } = await pool.query<{ id: string }>(
        "INSERT INTO entries (user_id, raw_text) VALUES ($1, $2) RETURNING id",
        [userId, text.trim()]
      );
      const entryId = rows[0].id;
      await enqueueProcessEntry(entryId);

      return reply.code(202).send({ entry_id: entryId, status: "pending" });
    }
  );

  // GET /entries/:id/status — poll for processing result
  app.get<{ Params: { id: string } }>(
    "/entries/:id/status",
    async (request, reply) => {
      const userId = request.user.id;
      const { id } = request.params;

      const { rows } = await pool.query(
        `SELECT e.id, e.status, e.raw_text, e.error,
                array_agg(n.id) FILTER (WHERE n.id IS NOT NULL) AS note_ids
         FROM entries e
         LEFT JOIN notes n ON n.entry_id = e.id
         WHERE e.id = $1 AND e.user_id = $2
         GROUP BY e.id`,
        [id, userId]
      );

      if (rows.length === 0)
        return sendError(reply, 404, "not_found", "Entry not found");

      const row = rows[0];

      if (row.status === "done") {
        return {
          entry_id: row.id,
          status: "done",
          note_ids: row.note_ids ?? [],
          transcript: row.raw_text,
        };
      }
      if (row.status === "failed") {
        return {
          entry_id: row.id,
          status: "failed",
          error: row.error ?? "Processing failed",
        };
      }
      return { entry_id: row.id, status: row.status };
    }
  );
};

export default entriesRoutes;
