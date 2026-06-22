import type { FastifyPluginAsync } from "fastify";
import { supabase } from "../lib/supabase.js";
import { sendError } from "../lib/errors.js";

const accountRoutes: FastifyPluginAsync = async (app) => {
  // DELETE /account — permanently deletes user + all data (Rule #10)
  app.delete("/account", async (request, reply) => {
    const userId = request.user.id;

    // Supabase admin delete cascades all user data via FK ON DELETE CASCADE
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      return sendError(reply, 500, "internal_error", "Failed to delete account");
    }

    return { deleted: true };
  });
};

export default accountRoutes;
