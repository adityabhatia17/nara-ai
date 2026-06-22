import type { FastifyRequest, FastifyReply } from "fastify";
import { supabase } from "../lib/supabase.js";
import { sendError } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(reply, 401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return sendError(reply, 401, "unauthorized", "Invalid or expired token");
  }
  request.user = { id: user.id, email: user.email ?? "" };
}
