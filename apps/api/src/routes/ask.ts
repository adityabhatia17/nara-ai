import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import { sendError } from "../lib/errors.js";

const askRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { question: string } }>("/ask", async (request, reply) => {
    const { question } = request.body ?? {};
    if (!question?.trim()) {
      return sendError(reply, 422, "unprocessable", "question is required");
    }

    let res: Response;
    try {
      res = await fetch(`${config.AI_WORKER_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: request.user.id, question: question.trim() }),
      });
    } catch {
      return sendError(reply, 503, "ai_unavailable", "AI worker unreachable — retry later");
    }

    if (!res.ok) {
      return sendError(reply, 503, "ai_unavailable", "AI worker returned an error — retry later");
    }

    const data = await res.json() as { answer: string; cited_note_ids: string[] };
    return { answer: data.answer, cited_note_ids: data.cited_note_ids ?? [] };
  });
};

export default askRoutes;
