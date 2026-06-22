import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../lib/supabase.js";
import { sendError } from "../lib/errors.js";

const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/magic-link
  app.post<{ Body: { email: string } }>(
    "/magic-link",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) return sendError(reply, 500, "internal_error", error.message);
      return { sent: true };
    }
  );

  // GET /auth/me — requires auth but we re-verify here from header
  app.get("/me", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(reply, 401, "unauthorized", "Missing token");
    }
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user)
      return sendError(reply, 401, "unauthorized", "Invalid token");
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      display_name: user.user_metadata?.display_name ?? null,
    };
  });
};

export default authRoutes;
